-- Personal todos (organization_id IS NULL) and team todos (JWT `o` claim):
--   { "id": "<org-uuid>", "slug": "<org-slug>", "role": "<member-role>" }
-- Requires Neon Auth Organizations plugin enabled on the auth endpoint.

CREATE TABLE public.todos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    user_id text NOT NULL,
    organization_id text,
    title text NOT NULL,
    completed boolean NOT NULL DEFAULT false,
    is_public boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_todos_organization_id ON public.todos (organization_id)
WHERE
    organization_id IS NOT NULL;

CREATE INDEX idx_todos_is_public ON public.todos (is_public)
WHERE
    is_public = true;

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Active organization from JWT claim `o`: { "id", "slug", "role" } (Neon Auth organization plugin).
CREATE OR REPLACE FUNCTION public.jwt_organization()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.jwt() -> 'o';
$$;

-- Signed-in users: org todos (JWT `o`), personal todos (organization_id IS NULL), or public.
CREATE POLICY "Authenticated users can view todos" ON public.todos FOR
SELECT TO authenticated USING (
    (
        organization_id IS NOT NULL
        AND organization_id = public.jwt_organization() ->> 'id'
    )
    OR (
        organization_id IS NULL
        AND user_id = auth.user_id ()
    )
    OR is_public = true
);

CREATE POLICY "Authenticated users can create todos" ON public.todos FOR
INSERT
TO authenticated
WITH
    CHECK (
        auth.user_id () = user_id
        AND (
            (
                organization_id IS NOT NULL
                AND organization_id = public.jwt_organization() ->> 'id'
            )
            OR organization_id IS NULL
        )
    );

CREATE POLICY "Authenticated users can update todos" ON public.todos FOR
UPDATE TO authenticated USING (
    (
        organization_id IS NOT NULL
        AND organization_id = public.jwt_organization() ->> 'id'
    )
    OR (
        organization_id IS NULL
        AND user_id = auth.user_id ()
    )
);

CREATE POLICY "Authenticated users can delete todos" ON public.todos FOR DELETE TO authenticated USING (
    (
        organization_id IS NOT NULL
        AND organization_id = public.jwt_organization() ->> 'id'
    )
    OR (
        organization_id IS NULL
        AND user_id = auth.user_id ()
    )
);

GRANT SELECT ON public.todos TO anonymous;

CREATE POLICY "Anonymous users can view public todos" ON public.todos FOR
SELECT TO anonymous USING (is_public = true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
