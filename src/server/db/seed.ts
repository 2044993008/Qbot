import { NextResponse } from 'next/server';
import { executeLocalSeed } from '../../../scripts/seed-local-db';

export async function POST() {
  try {
    const result = await executeLocalSeed();
    return NextResponse.json({
      success: true,
      message: 'Seed completed successfully',
      ...result,
    });
  } catch (error) {
    console.error('Seed API failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Seed failed',
      },
      { status: 500 }
    );
  }
}
