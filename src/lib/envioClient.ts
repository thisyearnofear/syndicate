/**
 * Envio GraphQL Client
 * 
 * Handles interactions with the Envio HyperIndex GraphQL API.
 * Defaults to local development URL if NEXT_PUBLIC_ENVIO_API_URL is not set.
 */

const ENVIO_API_URL = process.env.NEXT_PUBLIC_ENVIO_API_URL || 'http://localhost:8080/v1/graphql';

export async function fetchGraphQL<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
  try {
    const response = await fetch(ENVIO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }

    const json = await response.json();
    if (json.errors) {
      console.error('GraphQL Errors:', json.errors);
      throw new Error(JSON.stringify(json.errors));
    }
    return json.data;
  } catch (error) {
    console.error('Failed to fetch from Envio:', error);
    throw error;
  }
}
