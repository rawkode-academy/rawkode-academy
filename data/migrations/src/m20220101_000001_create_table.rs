use sea_orm_migration::prelude::*;

#[derive(Iden)]
enum Technology {
    Table,
    Name,
    Description,
}

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Technology::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Technology::Name)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Technology::Description).string().not_null())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Technology::Table).to_owned())
            .await
    }
}
