use miette::Diagnostic;
use thiserror::Error;

#[derive(Debug, Error, Diagnostic)]
#[error("{}", source_code)]
#[diagnostic(url("https://github.com/RawkodeAcademy/RawkodeAcademy/tree/main/projects/rawkode.studio/content-management/docs/{model_name}.md"))]
pub struct DependencyError {
    #[source_code]
    pub source_code: String,

    #[help]
    pub help: String,

    pub model_name: String,
}

#[derive(Debug, Error, Diagnostic)]
#[error("{} dependencies invalid", .errors.len())]
pub struct DependencyErrors {
    #[related]
    pub errors: Vec<DependencyError>,
}
