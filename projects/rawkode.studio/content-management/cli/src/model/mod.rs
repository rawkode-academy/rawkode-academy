use chrono::Duration;
use hhmmss::Hhmmss;
use lazy_static::lazy_static;
use miette::Result;
use regex::Regex;
use serde::Deserialize;

pub mod episode;
pub mod error;
pub mod people;
pub mod show;
pub mod technology;

pub use episode::*;
pub use error::*;
pub use people::*;
pub use show::*;
pub use technology::*;

lazy_static! {
    static ref DURATION: Regex = Regex::new(r#"([0-9]{1,2}):([0-9]{1,2}):?([0-9]{1,2})?"#).unwrap();
}

pub(crate) fn chapter_duration_de<'de, D>(deserializer: D) -> Result<Duration, D::Error>
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

            Ok(Duration::hours(hours) + Duration::minutes(minutes) + Duration::seconds(seconds))
        }
        (Some(minutes), Some(seconds), None) => {
            let minutes = minutes.as_str().parse::<i64>().map_err(|_| {
                serde::de::Error::custom(format!("Cannot parse minutes from {:?}", minutes))
            })?;

            let seconds = seconds.as_str().parse::<i64>().map_err(|_| {
                serde::de::Error::custom(format!("Cannot parse seconds from {:?}", seconds))
            })?;

            Ok(Duration::minutes(minutes) + Duration::seconds(seconds))
        }
        _ => Err(serde::de::Error::custom(format!(
            "Cannot parse Duration from {}",
            value
        ))),
    }
}

pub(crate) fn chapter_duration_ser<S>(duration: &Duration, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(duration.hhmmss().as_str())
}
