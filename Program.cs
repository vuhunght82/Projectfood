using Microsoft.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);

// Cấu hình CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader());
});

var app = builder.Build();
app.UseCors("AllowAll");

//string connectionString = @"Data Source=E:\Project System\database.db;";
string connectionString = "Data Source=database.db;";
// API 1: Lấy danh sách USER
app.MapGet("/api/users", () =>
{
    var users = new List<Dictionary<string, object>>();

    using (var connection = new SqliteConnection(connectionString))
    {
        connection.Open();
        var command = connection.CreateCommand();
        command.CommandText = "SELECT User_name, User_password, User_permission FROM USER;";

        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                var row = new Dictionary<string, object>
                {
                    ["User_name"] = reader["User_name"]?.ToString() ?? "",
                    ["User_password"] = reader["User_password"]?.ToString() ?? "",
                    ["User_permission"] = reader["User_permission"]?.ToString() ?? ""
                };
                users.Add(row);
            }
        }
    }
    return Results.Ok(users);
});

// API 2: Thêm USER mới
app.MapPost("/api/users", async (HttpContext context) =>
{
    var body = await context.Request.ReadFromJsonAsync<Dictionary<string, string>>();
    if (body == null || !body.ContainsKey("User_name") || string.IsNullOrEmpty(body["User_name"]))
    {
        return Results.BadRequest(new { message = "Vui lòng nhập User_name!" });
    }

    using (var connection = new SqliteConnection(connectionString))
    {
        connection.Open();
        var command = connection.CreateCommand();
        command.CommandText = @"
            INSERT INTO USER (User_name, User_password, User_permission)
            VALUES ($username, $password, $permission);
        ";
        command.Parameters.AddWithValue("$username", body["User_name"]);
        command.Parameters.AddWithValue("$password", body.GetValueOrDefault("User_password", "123"));
        command.Parameters.AddWithValue("$permission", body.GetValueOrDefault("User_permission", "1"));

        command.ExecuteNonQuery();
    }

    return Results.Ok(new { message = "Thêm USER thành công!" });
});

//app.Run("http://localhost:5000");
// Lắng nghe trên cổng 5000 cho tất cả IP kết nối vào
app.Run("http://0.0.0.0:5000");