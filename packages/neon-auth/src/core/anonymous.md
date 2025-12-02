when using the PG client, when there is no token in the cache, the behavuoyr should be:

1. call the anonymous endpoint, that we can build from the Neon Auth adapter
2. if the endpoint returns a token, cache the token
3. then we need to keep track of the TTL of this token and refresh it when it's about to expire



- neon better auth plugins suit:
- anonymous
  - this should be opted in
  - 
- oauth2