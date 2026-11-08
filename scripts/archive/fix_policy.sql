DROP POLICY IF EXISTS "Users can view users in same madrasa" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (id = auth.uid());
