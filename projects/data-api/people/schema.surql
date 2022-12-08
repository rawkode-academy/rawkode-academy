---
USE NS rawkode DB data;

DEFINE TABLE people SCHEMAFULL
    PERMISSIONS
        FOR select FULL
        FOR create, update, delete NONE;
DEFINE FIELD name ON TABLE people TYPE string;

DEFINE FIELD github ON TABLE people TYPE object;
DEFINE FIELD github.handle ON TABLE people TYPE string ASSERT string::length($value) > 1 AND string::length($value) < 39;
DEFINE FIELD github.url ON TABLE people TYPE string;

DEFINE FIELD email ON TABLE people TYPE string ASSERT is::email($value);
DEFINE INDEX email ON TABLE people COLUMNS email UNIQUE;
