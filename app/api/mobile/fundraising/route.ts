import type {NextRequest} from 'next/server';
import {mobileMahfil} from '@/lib/finance/mobile-mahfil';
export const dynamic='force-dynamic';
const handler=(req:NextRequest)=>mobileMahfil(req);
export {handler as GET,handler as POST};
