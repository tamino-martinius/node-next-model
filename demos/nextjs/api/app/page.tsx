export default function Page() {
  return (
    <>
      <h1>NextModel · Next.js API demo</h1>
      <p>
        A minimal Next.js 15 App Router app exposing a REST resource via{' '}
        <code>@next-model/nextjs-api</code> on top of <code>@next-model/sqlite-connector</code>. The
        UI is intentionally empty — this demo targets the API. Try:
      </p>
      <pre
        style={{
          background: 'rgba(127,127,127,0.15)',
          padding: '0.75rem',
          borderRadius: 6,
          overflow: 'auto',
        }}
      >
        {`# every action is behind an x-role header
curl -H 'x-role: member' http://localhost:3000/api/users

# delete is admin-only
curl -X DELETE http://localhost:3000/api/users/2            # → 401
curl -X DELETE -H 'x-role: admin' http://localhost:3000/api/users/2  # → 204

# create is admin-only too
curl -X POST -H 'x-role: admin' -H 'content-type: application/json' \\
  -d '{"name":"Grace","role":"admin","active":true}' http://localhost:3000/api/users
`}
      </pre>
      <p>
        Routes live under <code>app/api/users</code> — the handlers are two small
        <code>createCollectionHandlers</code> / <code>createMemberHandlers</code> exports that reuse
        the same hook surface as <code>@next-model/express-rest-api</code>.
      </p>
    </>
  );
}
