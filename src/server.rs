use std::convert::Infallible;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use axum::body::Bytes;
use axum::extract::{Path as UrlPath, Query, Request, State};
use axum::http::{header, StatusCode, Uri};
use axum::middleware::{self, Next};
use axum::response::sse::{Event, Sse};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post, put};
use axum::{Json, Router};
use rand::RngCore;
use serde::Serialize;
use serde_json::{json, Value};
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tokio::task::JoinHandle;

use crate::clock::now_iso;
use crate::drafts::{
    add_comment, load_draft, patch_comment, remove_comment, resolve_draft, set_overall, set_viewed,
    CommentPatch, NewComment,
};
use crate::export::{render_markdown, submit_review};
use crate::git;
use crate::review::{build_review, BuildOptions};
use crate::statics::{read_static_fs, WebSource};
use crate::types::{CommentTag, ReviewModel, ReviewPayload, Side};
use crate::watch::{watch_repo, RepoWatcher, DEFAULT_DEBOUNCE};

pub struct ServerOptions {
    pub build: BuildOptions,
    pub host: IpAddr,
    pub port: u16,
    pub web: WebSource,
}

impl Default for ServerOptions {
    fn default() -> Self {
        Self {
            build: BuildOptions::default(),
            host: IpAddr::V4(Ipv4Addr::LOCALHOST),
            port: 0,
            web: WebSource::Embedded,
        }
    }
}

pub struct RunningServer {
    pub url: String,
    pub port: u16,
    pub token: String,
    shutdown: Option<oneshot::Sender<()>>,
    handle: JoinHandle<()>,
}

impl RunningServer {
    pub async fn close(mut self) {
        if let Some(shutdown) = self.shutdown.take() {
            let _ = shutdown.send(());
        }

        if tokio::time::timeout(Duration::from_millis(250), &mut self.handle)
            .await
            .is_err()
        {
            self.handle.abort();
        }
    }
}

struct AppState {
    build: BuildOptions,
    token: String,
    web: WebSource,
    watcher: Arc<RepoWatcher>,
}

type Shared = Arc<AppState>;

impl AppState {
    fn context(&self) -> Result<(ReviewModel, PathBuf), ApiError> {
        let model = build_review(&self.build)?;
        let root = PathBuf::from(&model.repo_root);
        Ok((model, root))
    }
}

struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }

    fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }
}

impl From<git::GitError> for ApiError {
    fn from(err: git::GitError) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, format!("git: {err}"))
    }
}

impl From<std::io::Error> for ApiError {
    fn from(err: std::io::Error) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, err.to_string())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}

type ApiResult<T> = Result<Json<T>, ApiError>;

async fn blocking<T, F>(f: F) -> Result<T, ApiError>
where
    F: FnOnce() -> Result<T, ApiError> + Send + 'static,
    T: Send + 'static,
{
    match tokio::task::spawn_blocking(f).await {
        Ok(result) => result,
        Err(err) => Err(ApiError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("worker failed: {err}"),
        )),
    }
}

async fn require_token(
    State(state): State<Shared>,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let from_header = request
        .headers()
        .get("x-review-token")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);

    let presented = from_header.or_else(|| {
        request.uri().query().and_then(|query| {
            url_query_pairs(query)
                .into_iter()
                .find(|(key, _)| key == "token")
                .map(|(_, value)| value)
        })
    });

    if presented.as_deref() != Some(state.token.as_str()) {
        return Err(ApiError::new(StatusCode::FORBIDDEN, "bad token"));
    }

    Ok(next.run(request).await)
}

fn url_query_pairs(query: &str) -> Vec<(String, String)> {
    query
        .split('&')
        .filter(|pair| !pair.is_empty())
        .map(|pair| {
            let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
            let decode = |s: &str| {
                percent_encoding::percent_decode_str(&s.replace('+', " "))
                    .decode_utf8_lossy()
                    .into_owned()
            };
            (decode(key), decode(value))
        })
        .collect()
}

fn parse_json(body: &Bytes) -> Result<Value, ApiError> {
    serde_json::from_slice(body).map_err(|_| ApiError::bad_request("invalid JSON"))
}

fn string_field(body: &Value, key: &str) -> Option<String> {
    body.get(key).and_then(Value::as_str).map(str::to_string)
}

fn positive_field(body: &Value, key: &str) -> Option<u32> {
    let n = body.get(key)?.as_f64()?;
    if n.fract() != 0.0 || n < 1.0 {
        return None;
    }
    Some(n as u32)
}

fn side_field(body: &Value, key: &str) -> Option<Side> {
    match body.get(key).and_then(Value::as_str) {
        Some("old") => Some(Side::Old),
        Some("new") => Some(Side::New),
        _ => None,
    }
}

async fn get_review(State(state): State<Shared>) -> ApiResult<ReviewPayload> {
    blocking(move || {
        let (model, root) = state.context()?;
        let draft = resolve_draft(&root, &model, &load_draft(&root));

        Ok(Json(ReviewPayload { model, draft }))
    })
    .await
}

#[derive(Serialize)]
struct FileContent {
    path: String,
    side: &'static str,
    content: Option<String>,
}

async fn get_file(
    State(state): State<Shared>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> ApiResult<FileContent> {
    let path = params.get("path").cloned().unwrap_or_default();
    if path.is_empty() {
        return Err(ApiError::bad_request("path is required"));
    }

    let side = match params.get("side").map(String::as_str) {
        Some("old") => Side::Old,
        _ => Side::New,
    };

    blocking(move || {
        let root_string = git::repo_root(&state.build.cwd)?;
        let root = Path::new(&root_string);

        let content = match side {
            Side::Old => git::resolve_rev(root, &state.build.base)
                .and_then(|rev| git::read_blob(root, &rev, &path))
                .map(|bytes| String::from_utf8_lossy(&bytes).into_owned()),
            Side::New => read_static_fs(root, &path)
                .map(|file| String::from_utf8_lossy(&file.body).into_owned()),
        };

        Ok(Json(FileContent {
            path,
            side: match side {
                Side::Old => "old",
                Side::New => "new",
            },
            content,
        }))
    })
    .await
}

async fn create_comment(
    State(state): State<Shared>,
    body: Bytes,
) -> ApiResult<crate::types::Draft> {
    let body = parse_json(&body)?;

    let path = string_field(&body, "path").unwrap_or_default();
    let text = string_field(&body, "body").unwrap_or_default();
    if path.is_empty() || text.trim().is_empty() {
        return Err(ApiError::bad_request("path and body are required"));
    }

    let input = NewComment {
        path,
        side: side_field(&body, "side"),
        start_line: positive_field(&body, "startLine"),
        end_line: positive_field(&body, "endLine"),
        tag: CommentTag::parse_or_question(body.get("tag").and_then(Value::as_str)),
        body: text,
    };

    blocking(move || {
        let (model, root) = state.context()?;
        Ok(Json(add_comment(&root, &model, input)))
    })
    .await
}

async fn update_comment(
    State(state): State<Shared>,
    UrlPath(id): UrlPath<String>,
    body: Bytes,
) -> ApiResult<crate::types::Draft> {
    let body = parse_json(&body)?;

    let mut patch = CommentPatch::default();

    if !body.get("tag").unwrap_or(&Value::Null).is_null() {
        patch.tag = Some(CommentTag::parse_or_question(
            body.get("tag").and_then(Value::as_str),
        ));
    }

    if let Some(text) = string_field(&body, "body") {
        if text.trim().is_empty() {
            return Err(ApiError::bad_request("body cannot be empty"));
        }
        patch.body = Some(text);
    }

    blocking(move || {
        let (model, root) = state.context()?;
        Ok(Json(patch_comment(&root, &model, &id, patch)))
    })
    .await
}

async fn delete_comment(
    State(state): State<Shared>,
    UrlPath(id): UrlPath<String>,
) -> ApiResult<crate::types::Draft> {
    blocking(move || {
        let (model, root) = state.context()?;
        Ok(Json(remove_comment(&root, &model, &id)))
    })
    .await
}

async fn put_viewed(State(state): State<Shared>, body: Bytes) -> ApiResult<crate::types::Draft> {
    let body = parse_json(&body)?;

    let Some(path) = string_field(&body, "path") else {
        return Err(ApiError::bad_request("path is required"));
    };
    let digest = string_field(&body, "digest");

    blocking(move || {
        let (model, root) = state.context()?;
        Ok(Json(set_viewed(&root, &model, &path, digest.as_deref())))
    })
    .await
}

async fn put_overall(State(state): State<Shared>, body: Bytes) -> ApiResult<crate::types::Draft> {
    let body = parse_json(&body)?;
    let overall = string_field(&body, "overall").unwrap_or_default();

    blocking(move || {
        let (model, root) = state.context()?;
        Ok(Json(set_overall(&root, &model, &overall)))
    })
    .await
}

#[derive(Serialize)]
struct Preview {
    markdown: String,
}

async fn get_preview(State(state): State<Shared>) -> ApiResult<Preview> {
    blocking(move || {
        let (model, root) = state.context()?;
        let draft = resolve_draft(&root, &model, &load_draft(&root));

        Ok(Json(Preview {
            markdown: render_markdown(&root, &model, &draft),
        }))
    })
    .await
}

async fn post_submit(State(state): State<Shared>) -> ApiResult<crate::export::SubmitResult> {
    blocking(move || {
        let (model, root) = state.context()?;
        let draft = resolve_draft(&root, &model, &load_draft(&root));

        if draft.comments.is_empty() && draft.overall.trim().is_empty() {
            return Err(ApiError::bad_request("nothing to submit"));
        }

        Ok(Json(submit_review(&root, &model, &draft)?))
    })
    .await
}

async fn get_events(
    State(state): State<Shared>,
) -> Sse<impl futures::Stream<Item = Result<Event, Infallible>>> {
    let receiver = state.watcher.subscribe();
    let active = state.watcher.active();

    let stream = futures::stream::unfold(
        (Some(active), receiver),
        |(pending_ready, mut receiver)| async move {
            if let Some(active) = pending_ready {
                let event = Event::default().event("ready").data(active.to_string());
                return Some((Ok(event), (None, receiver)));
            }

            match receiver.changed().await {
                Ok(()) => {
                    let event = Event::default().event("changed").data(now_iso());
                    Some((Ok(event), (None, receiver)))
                }
                Err(_) => None,
            }
        },
    );

    Sse::new(stream)
}

fn bundle_headers(content_type: &'static str) -> [(header::HeaderName, &'static str); 2] {
    [
        (header::CONTENT_TYPE, content_type),
        (header::CACHE_CONTROL, "no-store"),
    ]
}

async fn spa(State(state): State<Shared>, uri: Uri) -> Response {
    let requested = uri.path();
    let target = if requested == "/" {
        "index.html"
    } else {
        requested
    };

    if let Some(file) = state.web.read(target) {
        return (bundle_headers(file.content_type), file.body).into_response();
    }

    match state.web.read("index.html") {
        Some(shell) => (bundle_headers(shell.content_type), shell.body).into_response(),
        None => (
            StatusCode::INTERNAL_SERVER_ERROR,
            "UI bundle is missing. Run `yarn --cwd web build`.",
        )
            .into_response(),
    }
}

fn router(state: Shared) -> Router {
    let api = Router::new()
        .route("/review", get(get_review))
        .route("/file", get(get_file))
        .route("/comments", post(create_comment))
        .route(
            "/comments/{id}",
            axum::routing::patch(update_comment).delete(delete_comment),
        )
        .route("/viewed", put(put_viewed))
        .route("/overall", put(put_overall))
        .route("/events", get(get_events))
        .route("/preview", get(get_preview))
        .route("/submit", post(post_submit))
        .layer(middleware::from_fn_with_state(state.clone(), require_token));

    Router::new()
        .nest("/api", api)
        .fallback(spa)
        .with_state(state)
}

fn session_token() -> String {
    let mut bytes = [0u8; 16];
    rand::rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

pub async fn start_server(opts: ServerOptions) -> anyhow::Result<RunningServer> {
    let token = session_token();

    let model = build_review(&opts.build)?;
    let watcher = Arc::new(watch_repo(Path::new(&model.repo_root), DEFAULT_DEBOUNCE));

    let state = Arc::new(AppState {
        build: opts.build,
        token: token.clone(),
        web: opts.web,
        watcher,
    });

    let listener = TcpListener::bind(SocketAddr::new(opts.host, opts.port)).await?;
    let port = listener.local_addr()?.port();

    let app = router(state);
    let (shutdown, shutdown_rx) = oneshot::channel();

    let handle = tokio::spawn(async move {
        let _ = axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .await;
    });

    Ok(RunningServer {
        url: format!("http://{}:{port}/?token={token}", opts.host),
        port,
        token,
        shutdown: Some(shutdown),
        handle,
    })
}
