/** Riot Match-V5 수집은 중단했다. 새 경기는 Windows LCU 에이전트가 전송한다. */
export async function GET() {
  return Response.json(
    { error: 'Riot sync is retired. Use the Windows LCU agent to upload games.' },
    { status: 410 },
  )
}
