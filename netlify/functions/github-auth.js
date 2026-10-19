/* ============================================================
   GitHub OAuth — серверная функция Netlify
   ============================================================ */

exports.handler = async (event) => {
  const { code } = event.queryStringParameters || {};
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = process.env;

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Не заданы GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET",
      }),
    };
  }

  // Хост Netlify-сайта: берём из заголовков (netlify сам подставит)
  const host = event.headers["x-forwarded-host"] || event.headers.host;
  const proto = event.headers["x-forwarded-proto"] || "https";
  const baseUrl = `${proto}://${host}`;
  const redirectUri = `${baseUrl}/api/github-auth`;

  // --- Ветка 1: GitHub вернул code → меняем на токен ---
  if (code) {
    try {
      const tokenRes = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri,
          }),
        },
      );
      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Не удалось получить токен",
            details: tokenData,
          }),
        };
      }

      // Забираем профиль пользователя
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "z1genxsis8c-site",
        },
      });
      const ghUser = await userRes.json();

      // Отдаём фронтенду минимум нужного
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          github: {
            id: ghUser.id,
            login: ghUser.login,
            name: ghUser.name || ghUser.login,
            avatar: ghUser.avatar_url,
            html_url: ghUser.html_url,
          },
        }),
      };
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Ошибка запроса к GitHub",
          details: String(err),
        }),
      };
    }
  }

  // --- Ветка 2: старт авторизации → редирект на GitHub ---
  const authUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${encodeURIComponent(GITHUB_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=read:user`;

  return {
    statusCode: 302,
    headers: { Location: authUrl },
  };
};
