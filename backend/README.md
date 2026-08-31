# Backend configuration

## Microsoft Entra ID authentication

The frontend must request an **access token for this API**, not an ID token or a
Microsoft Graph token. Keep the API registration separate from SPA/client app
registrations when possible.

Configure the services as follows:

- `VITE_ENTRA_SPA_CLIENT_ID` — application (client) ID of the SPA registration.
- `VITE_API_SCOPE` — delegated scope exposed by the API registration, for example
  `api://<api-client-id>/access_as_user`.
- `ENTRA_TENANT_ID` — tenant ID used by both registrations.
- `ENTRA_AUDIENCE` — application (client) ID or App ID URI of the **API**
  registration. Do not put the SPA client ID here unless the SPA and API truly
  share one registration.

For a GUID client ID, the backend accepts both `<api-client-id>` and
`api://<api-client-id>`, because Entra may use either representation in the
token's `aud` claim. Custom App ID URIs must match exactly. During a controlled
App ID URI migration, multiple explicit values can be supplied as a
comma-separated list, for example:

```env
ENTRA_AUDIENCE=api://old-api-uri,api://new-api-uri
```

Only list identifiers that belong to this API. Adding the audience of another
application would allow its access tokens to reach this backend.

### Changing `requestedAccessTokenVersion` to `2`

After changing the API manifest's `requestedAccessTokenVersion` from `1` to
`2`, a v2 access token normally identifies the API in `aud` by its application
(client) ID GUID. The scope requested by the frontend still includes the API
App ID URI and scope name, for example:

```env
VITE_API_SCOPE=api://<api-client-id>/access_as_user
ENTRA_AUDIENCE=<api-client-id>
```

Consequently, leaving a custom App ID URI such as `api://smm-api` in
`ENTRA_AUDIENCE` can cause `Invalid audience (ENTRA_AUDIENCE mismatch)` after
the version switch. Set `ENTRA_AUDIENCE` to the API registration's application
(client) ID GUID. The backend automatically accepts the equivalent
`api://<client-id>` form as well; it does not infer a GUID from a custom URI.

After changing scopes or app registrations, rebuild the frontend (Vite embeds
`VITE_*` values at build time), restart the backend, sign out, and clear the
MSAL browser cache before signing in again. If the API still responds with 401,
inspect the access token and verify that its `aud` claim is one of the configured
API identifiers and that `VITE_API_SCOPE` belongs to that same API registration.
