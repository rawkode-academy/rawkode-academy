use chrono::Duration;
use diacritics::remove_diacritics;

use hhmmss::Hhmmss;
use lazy_static::lazy_static;
use miette::Result;

use regex::Regex;
use serde::Deserialize;

use sqlx::postgres::types::PgInterval;
use unicode_normalization::UnicodeNormalization;

pub mod episode;
pub mod people;
pub mod show;
pub mod technology;

pub use episode::*;
pub use people::*;
pub use show::*;
pub use technology::*;

lazy_static! {
    static ref QUOTES: Regex = Regex::new(r#"["']+"#).unwrap();
    static ref NON_ALPHANUMERIC: Regex = Regex::new(r#"[^a-z0-9]+"#).unwrap();
    static ref LEADING_DASHES: Regex = Regex::new(r#"^-+"#).unwrap();
    static ref TRAILING_DASHES: Regex = Regex::new(r#"-+$"#).unwrap();
    static ref DURATION: Regex = Regex::new(r#"([0-9]{1,2}):([0-9]{1,2}):?([0-9]{1,2})?"#).unwrap();
}

pub(crate) fn chapter_duration_de<'de, D>(deserializer: D) -> Result<PgInterval, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = String::deserialize(deserializer)?;

    let captures = DURATION
        .captures(value.as_str())
        .ok_or_else(|| serde::de::Error::custom(format!("Cannot parse Duration from {}", value)))?;

    match (captures.get(1), captures.get(2), captures.get(3)) {
        (Some(hours), Some(minutes), Some(seconds)) => {
            let hours = hours.as_str().parse::<i64>().map_err(|_| {
                serde::de::Error::custom(format!("Cannot parse hours from {:?}", hours))
            })?;

            let minutes = minutes.as_str().parse::<i64>().map_err(|_| {
                serde::de::Error::custom(format!("Cannot parse minutes from {:?}", minutes))
            })?;

            let seconds = seconds.as_str().parse::<i64>().map_err(|_| {
                serde::de::Error::custom(format!("Cannot parse seconds from {:?}", seconds))
            })?;

            PgInterval::try_from(
                Duration::hours(hours) + Duration::minutes(minutes) + Duration::seconds(seconds),
            )
            .map_err(|_| serde::de::Error::custom(format!("Cannot parse Duration from {}", value)))
        }
        (Some(minutes), Some(seconds), None) => {
            let minutes = minutes.as_str().parse::<i64>().map_err(|_| {
                serde::de::Error::custom(format!("Cannot parse minutes from {:?}", minutes))
            })?;

            let seconds = seconds.as_str().parse::<i64>().map_err(|_| {
                serde::de::Error::custom(format!("Cannot parse seconds from {:?}", seconds))
            })?;

            PgInterval::try_from(Duration::minutes(minutes) + Duration::seconds(seconds)).map_err(
                |_| serde::de::Error::custom(format!("Cannot parse Duration from {}", value)),
            )
        }
        _ => Err(serde::de::Error::custom(format!(
            "Cannot parse Duration from {}",
            value
        ))),
    }
}

pub(crate) fn chapter_duration_ser<S>(
    duration: &PgInterval,
    serializer: S,
) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    let duration = Duration::microseconds(duration.microseconds);

    serializer.serialize_str(duration.hhmmss().as_str())
}

pub(crate) fn slugify(value: &str) -> String {
    let slug = value.nfd().collect::<String>();
    let slug = remove_diacritics(&slug);
    let slug = slug.to_lowercase();

    let slug = QUOTES.replace_all(&slug, "").to_string();
    let slug = NON_ALPHANUMERIC.replace_all(&slug, "-").to_string();
    let slug = LEADING_DASHES.replace_all(&slug, "").to_string();
    let slug = TRAILING_DASHES.replace_all(&slug, "").to_string();

    slug
}

pub(crate) trait InsertStatement {
    fn statement() -> &'static str;
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use pretty_assertions::assert_eq;

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("Hello World"), "hello-world");

        assert_eq!(
            slugify("Part 2 - Tutorial 1: Installation"),
            "part-2-tutorial-1-installation"
        );

        assert_eq!(
            slugify("Infrastructure as Code & GitOps"),
            "infrastructure-as-code-gitops"
        );

        assert_eq!(
            slugify("Introduction to Prometheus, PromQL, & PromLens"),
            "introduction-to-prometheus-promql-promlens"
        );

        assert_eq!(
            slugify("Live Debugging the Changelog's Production Kubernetes"),
            "live-debugging-the-changelogs-production-kubernetes"
        );
    }
}
