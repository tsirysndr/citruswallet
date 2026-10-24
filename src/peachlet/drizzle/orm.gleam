import peachlet/ffi/better_sqlite.{type Client}
import peachlet/ffi/js.{type Exception, type Js}
import gleam/dynamic/decode.{type Decoder}
import gleam/list
import gleam/option.{type Option, None, Some}
import gleam/result
import gleam/string

pub type Database =
  Js

pub type Condition =
  Js

pub type Order =
  Js

pub opaque type Codec(value) {
  Codec(encode: fn(value) -> Js, decode: Decoder(value))
}

pub opaque type Table(row) {
  Table(raw: Js, decoder: Decoder(row))
}

pub opaque type Column(value) {
  Column(property: String, raw: Js, codec: Codec(value))
}

pub opaque type Projection(row) {
  Projection(raw: Js, decoder: Decoder(row))
}

pub opaque type Target {
  Target(raw: Js)
}

pub opaque type Assignment {
  Assignment(property: String, value: Js)
}

pub opaque type Definition {
  Definition(property: String, builder: Js)
}

pub opaque type Constraint {
  Constraint(build: fn(Js) -> Js)
}

pub opaque type IndexColumn {
  IndexColumn(name: String, descending: Bool)
}

pub opaque type Query(row) {
  Query(
    table: Js,
    projection: Option(Js),
    decoder: Decoder(row),
    condition: Option(Condition),
    order: List(Order),
    limit: Option(Int),
    offset: Option(Int),
  )
}

pub opaque type Mutation {
  Insert(table: Js, values: List(Assignment), conflict: Option(Conflict))
  Update(table: Js, values: List(Assignment), condition: Option(Condition))
  Delete(table: Js, condition: Option(Condition))
}

type Conflict {
  Conflict(targets: List(Target), values: List(Assignment))
}

@external(javascript, "drizzle-orm/better-sqlite3", "drizzle")
fn drizzle(client: Client) -> Database

pub fn connect(client: Client) -> Database {
  drizzle(client)
}

@external(javascript, "drizzle-orm/better-sqlite3/migrator", "migrate")
fn migrate_raw(database: Database, options: Js) -> Nil

pub fn migrate(
  database: Database,
  folder folder: String,
) -> Result(Nil, Exception) {
  js.attempt(fn() {
    migrate_raw(database, js.object([#("migrationsFolder", js.string(folder))]))
  })
}

pub fn transaction(
  database: Database,
  failed failed: e,
  run operation: fn(Database) -> Result(a, e),
) -> Result(a, e) {
  let slot = js.cell(js.undefined())
  let _ =
    js.attempt(fn() {
      js.call(database, "transaction", [
        js.coerce(fn(scope: Database) {
          let outcome = operation(scope)
          js.cell_set(slot, js.coerce(outcome))
          case outcome {
            Ok(_) -> js.undefined()
            Error(_) -> js.call(scope, "rollback", [])
          }
        }),
        js.object([#("behavior", js.string("immediate"))]),
      ])
    })
  let settled = js.cell_get(slot)
  case js.is_nullish(settled) {
    True -> Error(failed)
    False -> js.coerce(settled)
  }
}

@external(javascript, "drizzle-orm/sqlite-core", "sqliteTable")
fn sqlite_table(name: String, columns: Js, extras: Js) -> Js

@external(javascript, "drizzle-orm/sqlite-core", "text")
fn text_builder(name: String) -> Js

@external(javascript, "drizzle-orm/sqlite-core", "integer")
fn integer_builder(name: String) -> Js

@external(javascript, "drizzle-orm/sqlite-core", "primaryKey")
fn primary_key_builder(options: Js) -> Js

@external(javascript, "drizzle-orm/sqlite-core", "unique")
fn unique_builder(name: String) -> Js

@external(javascript, "drizzle-orm/sqlite-core", "index")
fn index_builder(name: String) -> Js

@external(javascript, "drizzle-orm/sqlite-core", "uniqueIndex")
fn unique_index_builder(name: String) -> Js

pub fn text(name: String) -> Definition {
  Definition(name, text_builder(name))
}

pub fn integer(name: String) -> Definition {
  Definition(name, integer_builder(name))
}

pub fn not_null(definition: Definition) -> Definition {
  modify(definition, "notNull", [])
}

pub fn primary_key(definition: Definition) -> Definition {
  modify(definition, "primaryKey", [])
}

pub fn unique_value(definition: Definition) -> Definition {
  modify(definition, "unique", [])
}

pub fn default_text(definition: Definition, value: String) -> Definition {
  modify(definition, "default", [js.string(value)])
}

pub fn default_int(definition: Definition, value: Int) -> Definition {
  modify(definition, "default", [js.int(value)])
}

fn modify(
  definition: Definition,
  method: String,
  arguments: List(Js),
) -> Definition {
  Definition(
    definition.property,
    js.call(definition.builder, method, arguments),
  )
}

pub fn composite_primary_key(columns: List(String)) -> Constraint {
  Constraint(fn(columns_of) {
    primary_key_builder(
      js.object([#("columns", js.list(references(columns_of, columns)))]),
    )
  })
}

pub fn composite_unique(name: String, columns: List(String)) -> Constraint {
  Constraint(fn(columns_of) {
    js.call(unique_builder(name), "on", references(columns_of, columns))
  })
}

pub fn asc(name: String) -> IndexColumn {
  IndexColumn(name, False)
}

pub fn desc(name: String) -> IndexColumn {
  IndexColumn(name, True)
}

pub fn index(name: String, columns: List(IndexColumn)) -> Constraint {
  Constraint(fn(columns_of) {
    js.call(index_builder(name), "on", ordered(columns_of, columns))
  })
}

pub fn unique_index(name: String, columns: List(IndexColumn)) -> Constraint {
  Constraint(fn(columns_of) {
    js.call(unique_index_builder(name), "on", ordered(columns_of, columns))
  })
}

pub fn only_where(constraint: Constraint, predicate: String) -> Constraint {
  Constraint(fn(columns_of) {
    js.call(constraint.build(columns_of), "where", [raw(predicate)])
  })
}

fn references(columns_of: Js, columns: List(String)) -> List(Js) {
  list.map(columns, js.get(columns_of, _))
}

fn ordered(columns_of: Js, columns: List(IndexColumn)) -> List(Js) {
  list.map(columns, fn(column) {
    let reference = js.get(columns_of, column.name)
    case column.descending {
      True -> desc_raw(reference)
      False -> reference
    }
  })
}

pub fn table(
  name: String,
  columns: List(Definition),
  constraints: List(Constraint),
  decoder: Decoder(row),
) -> Table(row) {
  Table(
    sqlite_table(
      name,
      js.object(
        list.map(columns, fn(column) { #(column.property, column.builder) }),
      ),
      js.coerce(fn(columns_of: Js) {
        js.list(
          list.map(constraints, fn(constraint) { constraint.build(columns_of) }),
        )
      }),
    ),
    decoder,
  )
}

pub fn underlying(table: Table(row)) -> Js {
  table.raw
}

pub fn string_codec() -> Codec(String) {
  Codec(js.string, decode.string)
}

pub fn int_codec() -> Codec(Int) {
  Codec(js.int, decode.int)
}

pub fn bool_codec() -> Codec(Bool) {
  Codec(
    fn(value) {
      js.int(case value {
        True -> 1
        False -> 0
      })
    },
    decode.map(decode.int, fn(stored) { stored != 0 }),
  )
}

pub fn bool_decoder() -> Decoder(Bool) {
  bool_codec().decode
}

pub fn optional_codec(codec: Codec(a)) -> Codec(Option(a)) {
  Codec(
    fn(value) {
      case value {
        Some(value) -> codec.encode(value)
        None -> js.null()
      }
    },
    decode.optional(codec.decode),
  )
}

pub fn column(table: Table(row), name: String, codec: Codec(a)) -> Column(a) {
  Column(name, js.get(table.raw, name), codec)
}

pub fn string_column(table: Table(row), name: String) -> Column(String) {
  column(table, name, string_codec())
}

pub fn int_column(table: Table(row), name: String) -> Column(Int) {
  column(table, name, int_codec())
}

pub fn bool_column(table: Table(row), name: String) -> Column(Bool) {
  column(table, name, bool_codec())
}

pub fn optional_string_column(
  table: Table(row),
  name: String,
) -> Column(Option(String)) {
  column(table, name, optional_codec(string_codec()))
}

pub fn optional_int_column(
  table: Table(row),
  name: String,
) -> Column(Option(Int)) {
  column(table, name, optional_codec(int_codec()))
}

@external(javascript, "drizzle-orm", "eq")
fn eq_raw(column: Js, value: Js) -> Condition

@external(javascript, "drizzle-orm", "ne")
fn ne_raw(column: Js, value: Js) -> Condition

@external(javascript, "drizzle-orm", "gt")
fn gt_raw(column: Js, value: Js) -> Condition

@external(javascript, "drizzle-orm", "lte")
fn lte_raw(column: Js, value: Js) -> Condition

@external(javascript, "drizzle-orm", "isNull")
fn is_null_raw(column: Js) -> Condition

@external(javascript, "drizzle-orm", "inArray")
fn in_array_raw(column: Js, values: Js) -> Condition

@external(javascript, "drizzle-orm", "and")
fn and_raw(condition: Js) -> Condition

@external(javascript, "drizzle-orm", "desc")
fn desc_raw(column: Js) -> Order

@external(javascript, "drizzle-orm", "sql")
fn sql_tag(strings: Js) -> Js

fn raw(sql: String) -> Js {
  js.call(js.coerce(sql_tag), "raw", [js.string(sql)])
}

pub fn eq(column: Column(a), value: a) -> Condition {
  eq_raw(column.raw, column.codec.encode(value))
}

pub fn ne(column: Column(a), value: a) -> Condition {
  ne_raw(column.raw, column.codec.encode(value))
}

pub fn gt(column: Column(a), value: a) -> Condition {
  gt_raw(column.raw, column.codec.encode(value))
}

pub fn lte(column: Column(a), value: a) -> Condition {
  lte_raw(column.raw, column.codec.encode(value))
}

pub fn is_null(column: Column(Option(a))) -> Condition {
  is_null_raw(column.raw)
}

pub fn in_list(column: Column(a), values: List(a)) -> Condition {
  in_array_raw(column.raw, js.list(list.map(values, column.codec.encode)))
}

pub fn all_of(conditions: List(Condition)) -> Option(Condition) {
  case conditions {
    [] -> None
    [only] -> Some(only)
    conditions -> Some(js.coerce(js.apply(js.coerce(and_raw), conditions)))
  }
}

pub fn descending(column: Column(a)) -> Order {
  desc_raw(column.raw)
}

pub fn pick(name: String, column: Column(a)) -> Projection(a) {
  Projection(
    js.object([#(name, column.raw)]),
    decode.at([name], column.codec.decode),
  )
}

pub fn from(table: Table(row)) -> Query(row) {
  Query(
    table: table.raw,
    projection: None,
    decoder: table.decoder,
    condition: None,
    order: [],
    limit: None,
    offset: None,
  )
}

pub fn select(table: Table(row), projection: Projection(a)) -> Query(a) {
  Query(
    table: table.raw,
    projection: Some(projection.raw),
    decoder: projection.decoder,
    condition: None,
    order: [],
    limit: None,
    offset: None,
  )
}

pub fn where(query: Query(row), conditions: List(Condition)) -> Query(row) {
  Query(..query, condition: all_of(conditions))
}

pub fn order_by(query: Query(row), order: List(Order)) -> Query(row) {
  Query(..query, order: order)
}

pub fn limit(query: Query(row), count: Int) -> Query(row) {
  Query(..query, limit: Some(count))
}

pub fn all(query: Query(row), database: Database) -> List(row) {
  case js.attempt(fn() { js.call(compile(query, database), "all", []) }) {
    Ok(rows) ->
      js.as_list(rows)
      |> list.filter_map(fn(row) {
        decode.run(row, query.decoder) |> result.replace_error(Nil)
      })
    Error(_) -> []
  }
}

pub fn one(query: Query(row), database: Database) -> Option(row) {
  case js.attempt(fn() { js.call(compile(query, database), "get", []) }) {
    Ok(row) ->
      case js.is_nullish(row) {
        True -> None
        False -> option.from_result(decode.run(row, query.decoder))
      }
    Error(_) -> None
  }
}

fn compile(query: Query(row), database: Database) -> Js {
  let selected = case query.projection {
    Some(projection) -> js.call(database, "select", [projection])
    None -> js.call(database, "select", [])
  }
  let source = js.call(selected, "from", [query.table])
  let filtered = case query.condition {
    Some(condition) -> js.call(source, "where", [condition])
    None -> source
  }
  let ordered = case query.order {
    [] -> filtered
    order -> js.call(filtered, "orderBy", order)
  }
  let limited = case query.limit {
    Some(count) -> js.call(ordered, "limit", [js.int(count)])
    None -> ordered
  }
  case query.offset {
    Some(count) -> js.call(limited, "offset", [js.int(count)])
    None -> limited
  }
}

pub fn set(column: Column(a), value: a) -> Assignment {
  Assignment(column.property, column.codec.encode(value))
}

pub fn insert(table: Table(row), values: List(Assignment)) -> Mutation {
  Insert(table.raw, values, None)
}

pub fn target(column: Column(a)) -> Target {
  Target(column.raw)
}

pub fn on_conflict_update(
  mutation: Mutation,
  target: List(Target),
  values: List(Assignment),
) -> Mutation {
  case mutation {
    Insert(table, inserted, _) ->
      Insert(table, inserted, Some(Conflict(target, values)))
    other -> other
  }
}

pub fn update(
  table: Table(row),
  values: List(Assignment),
  conditions: List(Condition),
) -> Mutation {
  Update(table.raw, values, all_of(conditions))
}

pub fn delete(table: Table(row), conditions: List(Condition)) -> Mutation {
  Delete(table.raw, all_of(conditions))
}

pub fn run(mutation: Mutation, database: Database) -> Result(Int, Exception) {
  use outcome <- result.try(
    js.attempt(fn() { js.call(statement(mutation, database), "run", []) }),
  )
  Ok(option.unwrap(js.int_field(outcome, "changes"), 0))
}

fn statement(mutation: Mutation, database: Database) -> Js {
  case mutation {
    Insert(table, values, conflict) -> {
      let inserted =
        js.call(js.call(database, "insert", [table]), "values", [
          assignments(values),
        ])
      case conflict {
        None -> inserted
        Some(Conflict(targets, updates)) ->
          js.call(inserted, "onConflictDoUpdate", [
            js.object([
              #("target", js.list(list.map(targets, fn(it) { it.raw }))),
              #("set", assignments(updates)),
            ]),
          ])
      }
    }
    Update(table, values, condition) ->
      filter(
        js.call(js.call(database, "update", [table]), "set", [
          assignments(values),
        ]),
        condition,
      )
    Delete(table, condition) ->
      filter(js.call(database, "delete", [table]), condition)
  }
}

fn filter(statement: Js, condition: Option(Condition)) -> Js {
  case condition {
    Some(condition) -> js.call(statement, "where", [condition])
    None -> statement
  }
}

fn assignments(values: List(Assignment)) -> Js {
  js.object(list.map(values, fn(value) { #(value.property, value.value) }))
}

pub fn is_unique_violation(exception: Exception) -> Bool {
  string.contains(exception.message, "UNIQUE constraint")
}

@external(javascript, "drizzle-orm", "or")
fn or_raw(condition: Js) -> Condition

@external(javascript, "drizzle-orm", "asc")
fn asc_raw(column: Js) -> Order

@external(javascript, "drizzle-orm", "count")
fn count_raw() -> Js

pub fn any_of(conditions: List(Condition)) -> Condition {
  js.coerce(js.apply(js.coerce(or_raw), conditions))
}

pub fn ascending(column: Column(a)) -> Order {
  asc_raw(column.raw)
}

pub fn offset(query: Query(row), count: Int) -> Query(row) {
  Query(..query, offset: Some(count))
}

pub fn count_rows() -> Projection(Int) {
  Projection(
    js.object([#("count", count_raw())]),
    decode.at(["count"], decode.int),
  )
}

/// Literal substring search: SQL values stay bound, including % and _.
pub fn contains(column: Column(a), value: String) -> Condition {
  js.coerce(
    js.apply(js.coerce(sql_tag), [
      js.list(list.map(["instr(lower(", "), lower(", ")) > 0"], js.string)),
      column.raw,
      js.string(value),
    ]),
  )
}

pub type SearchIndex {
  PaymentSearch
  ProfileSearch
}

/// Match a literal phrase, never interpreting user input as FTS query syntax.
/// Call only for queries of at least three characters (the trigram minimum).
pub fn fts_matches(
  column: Column(String),
  index: SearchIndex,
  value: String,
) -> Condition {
  let subquery = case index {
    PaymentSearch ->
      " IN (SELECT id FROM payments_fts WHERE payments_fts MATCH "
    ProfileSearch ->
      " IN (SELECT did FROM user_profiles_fts WHERE user_profiles_fts MATCH "
  }
  let phrase = "\"" <> string.replace(value, "\"", "\"\"") <> "\""
  js.coerce(
    js.apply(js.coerce(sql_tag), [
      js.list(list.map(["", subquery, ")"], js.string)),
      column.raw,
      js.string(phrase),
    ]),
  )
}

pub fn in_query(
  column: Column(a),
  query: Query(a),
  database: Database,
) -> Condition {
  in_array_raw(column.raw, compile(query, database))
}

/// Compare columns without binding the second column as a literal value.
pub fn columns_equal(left: Column(a), right: Column(a)) -> Condition {
  eq_raw(left.raw, right.raw)
}

@external(javascript, "drizzle-orm", "exists")
fn exists_raw(query: Js) -> Condition

pub fn exists(query: Query(a), database: Database) -> Condition {
  exists_raw(compile(query, database))
}
