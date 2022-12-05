use sea_orm::entity::prelude::*;
use serde::Deserialize;

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn schema_name(&self) -> Option<&str> {
        Some("public")
    }

    fn table_name(&self) -> &str {
        "people"
    }
}

#[derive(Clone, Debug, PartialEq, Eq, DeriveModel, DeriveActiveModel, Deserialize)]
pub struct Model {
    pub name: String,
    pub email: Option<String>,
    pub biography: Option<String>,
    #[serde(alias = "github")]
    pub github_handle: String,
    #[serde(alias = "twitter")]
    pub twitter_handle: Option<String>,
    #[serde(alias = "youtube")]
    pub youtube_handle: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Name,
    Email,
    Biography,
    GithubHandle,
    TwitterHandle,
    YoutubeHandle,
}

#[derive(Copy, Clone, Debug, EnumIter, DerivePrimaryKey)]
pub enum PrimaryKey {
    GithubHandle,
}

impl PrimaryKeyTrait for PrimaryKey {
    type ValueType = String;

    fn auto_increment() -> bool {
        false
    }
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl Related<super::shows::Entity> for Entity {
    fn to() -> RelationDef {
        super::shows::hosts::Relation::Show.def()
    }

    fn via() -> Option<RelationDef> {
        Some(super::shows::hosts::Relation::Person.def().rev())
    }
}

impl ColumnTrait for Column {
    type EntityName = Entity;

    fn def(&self) -> ColumnDef {
        match self {
            Self::Name => ColumnType::String(Some(64)).def(),
            Self::Email => ColumnType::String(Some(255))
                .def()
                .indexed()
                .unique()
                .nullable(),
            Self::Biography => ColumnType::Text.def().nullable(),
            Self::GithubHandle => ColumnType::String(Some(64)).def().indexed().unique(),
            Self::TwitterHandle => ColumnType::String(Some(64))
                .def()
                .indexed()
                .unique()
                .nullable(),
            Self::YoutubeHandle => ColumnType::String(Some(64))
                .def()
                .indexed()
                .unique()
                .nullable(),
        }
    }
}

impl ActiveModelBehavior for ActiveModel {}
