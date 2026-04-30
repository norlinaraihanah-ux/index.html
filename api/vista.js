export default async function handler(req, res) {
  const apiKey = process.env.VISTA_SOCIAL_API_KEY;
  
  const response = await fetch(
    `https://vistasocial.com/api/integration/mcp?api_key=${apiKey}`,
    { method: "GET", headers: { "Content-Type": "application/json" } }
  );

  const data = await response.json();
  res.status(200).json(data);
}
