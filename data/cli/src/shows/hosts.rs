use sea_orm::entity::prelude::*;

#[derive(Copy, Clone, Default, Debug, DeriveEntity)]
pub struct Entity;

impl EntityName for Entity {
    fn table_name(&self) -> &str {
        "show_hosts"
    }
}

#[derive(Clone, Debug, PartialEq, Eq, DeriveModel, DeriveActiveModel)]
pub struct Model {
    pub show: String,
    pub host: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveColumn)]
pub enum Column {
    Show,
    Host,
}

#[derive(Copy, Clone, Debug, EnumIter, DerivePrimaryKey)]
pub enum PrimaryKey {
    Show,
    Host,
}

impl PrimaryKeyTrait for PrimaryKey {
    type ValueType = (String, String);

    fn auto_increment() -> bool {
        false
    }
}

#[derive(Copy, Clone, Debug, EnumIter)]
pub enum Relation {
    Person,
    Show,
}

impl RelationTrait for Relation {
    fn def(&self) -> RelationDef {
        match self {
            Self::Person => Entity::belongs_to(crate::people::Entity)
                .from(Column::Host)
                .to(crate::people::Column::GithubHandle)
                .into(),
            Self::Show => Entity::belongs_to(super::Entity)
                .from(Column::Show)
                .to(super::Column::Name)
                .into(),
        }
    }
}

impl ColumnTrait for Column {
    type EntityName = Entity;

    fn def(&self) -> ColumnDef {
        match self {
            Self::Host => crate::people::Column::GithubHandle.def(),
            Self::Show => super::Column::Name.def(),
        }
    }
}

impl ActiveModelBehavior for ActiveModel {}
