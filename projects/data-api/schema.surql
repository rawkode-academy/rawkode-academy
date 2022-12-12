--- People
DEFINE TABLE people SCHEMAFULL
    PERMISSIONS
        FOR select FULL
        FOR create, update, delete FULL;
DEFINE FIELD name ON TABLE people TYPE string;

DEFINE FIELD github ON TABLE people TYPE object;
DEFINE FIELD github.handle ON TABLE people TYPE string ASSERT  $value != NONE AND string::length($value) > 1 AND string::length($value) < 39;
DEFINE FIELD github.url ON TABLE people TYPE string VALUE string::concat("https://github.com/", github.handle);

DEFINE FIELD email ON TABLE people TYPE string;
DEFINE INDEX email ON TABLE people COLUMNS email UNIQUE;
