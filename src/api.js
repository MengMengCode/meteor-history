export async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed. Try again shortly.');
    error.code = data.code;
    error.resetAt = data.resetAt;
    throw error;
  }
  return data;
}
