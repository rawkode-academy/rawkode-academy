pub trait Entity {
    fn id(&self) -> String;
    fn create_sql() -> &'static str;
}
