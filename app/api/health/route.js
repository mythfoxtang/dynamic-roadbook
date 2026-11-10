import {NextResponse} from 'next/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(){return NextResponse.json({service:'dynamic-roadbook',status:'ready',supervised:Boolean(process.env.ROADBOOK_SERVICE_INSTANCE),instance:process.env.ROADBOOK_SERVICE_INSTANCE||null,uptimeSeconds:Math.floor(process.uptime())},{headers:{'Cache-Control':'no-store'}});}
