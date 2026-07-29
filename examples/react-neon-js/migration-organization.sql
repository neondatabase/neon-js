-- Apply on existing databases that used the pre-organization migration.sql.
-- Requires Neon Auth Organizations plugin enabled.

ALTER TABLE public.todos
ADD COLUMN IF NOT EXISTS organization_id text;

CREATE INDEX IF NOT EXISTS idx_todos_organization_id ON public.todos (organization_id)
WHERE
    organization_id IS NOT NULL;

DROP POLICY IF EXISTS "Users can view their own todos" ON public.todos;

DROP POLICY IF EXISTS "Users can create their own todos" ON public.todos;

DROP POLICY IF EXISTS "Users can update their own todos" ON public.todos;

DROP POLICY IF EXISTS "Users can delete their own todos" ON public.todos;

DROP POLICY IF EXISTS "Org members can view org todos" ON public.todos;

DROP POLICY IF EXISTS "Org members can create org todos" ON public.todos;

DROP POLICY IF EXISTS "Org members can update org todos" ON public.todos;

DROP POLICY IF EXISTS "Org members can delete org todos" ON public.todos;

DROP POLICY IF EXISTS "Authenticated users can view todos" ON public.todos;

DROP POLICY IF EXISTS "Authenticated users can create todos" ON public.todos;

DROP POLICY IF EXISTS "Authenticated users can update todos" ON public.todos;

DROP POLICY IF EXISTS "Authenticated users can delete todos" ON public.todos;

DROP FUNCTION IF EXISTS public.jwt_organization();

CREATE OR REPLACE FUNCTION public.jwt_organization()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.jwt() -> 'o';
$$;

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
