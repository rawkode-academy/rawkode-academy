use sea_orm::entity::prelude::*;
use serde::Deserialize;

pub mod hosts;

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "shows"
    }
}

#[derive(Clone, Debug, PartialEq, Eq, DeriveModel, DeriveActiveModel, Deserialize)]
pub struct Model {
    pub name: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
pub struct YamlModel {
    #[serde(flatten)]
    pub model: Model,
    pub hosts: Vec<String>,
}

impl Into<Model> for YamlModel {
    fn into(self) -> Model {
        self.model
    }
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Name,
}

#[derive(Copy, Clone, Debug, EnumIter, DerivePrimaryKey)]
pub enum PrimaryKey {
    Name,
}

impl PrimaryKeyTrait for PrimaryKey {
    type ValueType = String;

    fn auto_increment() -> bool {
        false
    }
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl Related<super::people::Entity> for Entity {
    fn to() -> RelationDef {
        hosts::Relation::Person.def()
    }

    fn via() -> Option<RelationDef> {
        Some(hosts::Relation::Show.def().rev())
    }
}

impl ColumnTrait for Column {
    type EntityName = Entity;

    fn def(&self) -> ColumnDef {
        match self {
            Self::Name => ColumnType::String(Some(64)).def(),
        }
    }
}

impl ActiveModelBehavior for ActiveModel {}
