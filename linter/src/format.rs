use std::str::FromStr;

use chrono::{DateTime, Utc};
use knuffel::Decode;

#[derive(Decode, Debug)]
pub struct Chapter {
    #[knuffel(property)]
    pub time: String,

    #[knuffel(property)]
    pub title: String,
}

#[derive(Decode, Debug)]
pub struct Link {
    #[knuffel(argument)]
    pub link: String,
}

#[derive(Debug)]
pub struct UtcDateTime(DateTime<Utc>);

impl FromStr for UtcDateTime {
    type Err = chrono::format::ParseError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        DateTime::parse_from_rfc3339(s)
            .map(|dt| dt.with_timezone(&Utc))
            .map(UtcDateTime)
    }
}

#[derive(Decode, Debug)]
pub struct Episode {
    #[knuffel(child, unwrap(argument))]
    pub title: String,

    #[knuffel(child, unwrap(argument))]
    pub show: String,

    #[knuffel(child, unwrap(argument, str))]
    pub published_at: UtcDateTime,

    #[knuffel(child, unwrap(argument))]
    pub youtube_id: Option<String>,

    #[knuffel(child, unwrap(argument))]
    pub youtube_category: Option<u8>,

    #[knuffel(child, unwrap(children))]
    pub links: Vec<Link>,

    #[knuffel(child, unwrap(children))]
    pub chapters: Vec<Chapter>,
}
