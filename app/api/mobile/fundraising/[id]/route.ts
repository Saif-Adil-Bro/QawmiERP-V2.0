import type {NextRequest} from 'next/server';
import {mobileMahfil} from '@/lib/finance/mobile-mahfil';
export const dynamic='force-dynamic';
const handler=async (req:NextRequest,ctx:{params:Promise<{id:string}>})=>mobileMahfil(req,(await ctx.params).id);
export {handler as GET,handler as PATCH,handler as PUT,handler as DELETE};
