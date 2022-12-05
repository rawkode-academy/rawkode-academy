use crate::people::Entity as Person;
use crate::people::Model as PersonModel;
use crate::shows::hosts::Entity as ShowHosts;
use crate::shows::hosts::Model as ShowHostsModel;
use crate::shows::Entity as Show;
use crate::shows::Model as ShowModel;
use crate::shows::YamlModel as ShowYamlModel;
use crate::technologies::Entity as Technology;
use sea_orm::EntityTrait;
use sea_orm::{ConnectOptions, ConnectionTrait, Database, DbErr, Schema, Statement};

pub async fn run() -> Result<(), DbErr> {
    let connection_string = std::env::var("POSTGRESQL_CONNECTION_STRING").unwrap();

    let connect_options = ConnectOptions::new(connection_string.into())
        .set_schema_search_path("public".into())
        .to_owned();

    let db = Database::connect(connect_options).await?;

    db.execute(Statement {
        sql: "DROP SCHEMA public CASCADE".into(),
        values: None,
        db_backend: db.get_database_backend(),
    })
    .await?;

    db.execute(Statement {
        sql: "CREATE SCHEMA public".into(),
        values: None,
        db_backend: db.get_database_backend(),
    })
    .await?;

    let builder = db.get_database_backend();

    let schema = Schema::new(builder);

    db.execute(builder.build(&schema.create_table_from_entity(Technology)))
        .await?;

    let index_statements = &schema.create_index_from_entity(Technology);
    for index_statement in index_statements {
        db.execute(builder.build(index_statement)).await?;
    }

    db.execute(builder.build(&schema.create_table_from_entity(Person)))
        .await?;

    let index_statements = &schema.create_index_from_entity(Person);
    for index_statement in index_statements {
        db.execute(builder.build(index_statement)).await?;
    }

    //
    db.execute(builder.build(&schema.create_table_from_entity(Show)))
        .await?;

    let index_statements = &schema.create_index_from_entity(Show);
    for index_statement in index_statements {
        db.execute(builder.build(index_statement)).await?;
    }

    //
    db.execute(builder.build(&schema.create_table_from_entity(ShowHosts)))
        .await?;

    let index_statements = &schema.create_index_from_entity(ShowHosts);
    for index_statement in index_statements {
        db.execute(builder.build(index_statement)).await?;
    }

    // Load and decode YAML from all files on disk in yaml folder
    let mut people: Vec<crate::people::ActiveModel> = Vec::new();
    for entry in std::fs::read_dir("people").unwrap() {
        let entry = entry.unwrap();
        let path = entry.path();
        if path.is_file() && path.extension().unwrap() == "yaml" {
            let file = std::fs::File::open(path).unwrap();
            let reader = std::io::BufReader::new(file);
            let person: PersonModel = serde_yaml::from_reader(reader).unwrap();
            people.push(crate::people::ActiveModel::from(person));
        }
    }

    Person::insert_many(people).exec(&db).await?;

    // Load and decode YAML from all files on disk in yaml folder
    let mut shows: Vec<crate::shows::ActiveModel> = Vec::new();
    let mut show_hosts: Vec<crate::shows::hosts::ActiveModel> = Vec::new();

    for entry in std::fs::read_dir("shows").unwrap() {
        let entry = entry.unwrap();
        let path = entry.path();
        if path.is_file() && path.extension().unwrap() == "yaml" {
            let file = std::fs::File::open(path).unwrap();
            let reader = std::io::BufReader::new(file);
            let show: ShowYamlModel = serde_yaml::from_reader(reader).unwrap();
            let show_name = show.model.clone().name;

            shows.push(crate::shows::ActiveModel::from(show.model));

            for host in show.hosts {
                show_hosts.push(
                    crate::shows::hosts::Model {
                        show: show_name.clone(),
                        host,
                    }
                    .into(),
                );
            }
        }
    }

    Show::insert_many(shows).exec(&db).await?;
    ShowHosts::insert_many(show_hosts).exec(&db).await?;

    Ok(())
}
