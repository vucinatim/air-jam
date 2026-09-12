import { randomUUID } from "node:crypto";
import { createDisposablePostgresDatabase } from "../../tests/helpers/postgres-fixture.js";

/** Only the launch rehearsal needs creator identities and budget authority. */
export const createLaunchDatabase = async (baseUrl: URL, runId: string) => {
  const fixture = await createDisposablePostgresDatabase(baseUrl, runId);
  const { observer } = fixture;
  try {
    const apps: string[] = [];
    for (let i = 0; i < 12; i++) {
      const user = `load-user-${i}`;
      const game = `load-game-${i}`;
      const key = `aj_load_${randomUUID().replaceAll("-", "")}`;
      await observer`insert into users(id,name,email,email_verified,created_at,updated_at)
        values(${user},'Launch rehearsal',${`${user}@example.invalid`},true,now(),now())`;
      await observer`insert into games(id,user_id,name,config,created_at,updated_at)
        values(${game},${user},'Launch rehearsal','{}',now(),now())`;
      await observer`insert into app_ids(id,game_id,creator_id,key,is_active,allowed_origins,created_at)
        values(${`load-app-${i}`},${game},${user},${key},true,'["http://127.0.0.1"]'::jsonb,now())`;
      apps.push(key);
    }
    await observer`insert into operational_budget_cycles(id,period_start,period_end,profile,
      normal_target_microusd,warning_microusd,protection_microusd,near_ceiling_microusd,ceiling_microusd)
      values('load-cycle',now()-interval '1 hour',now()+interval '3 hours','ordinary',25000000,50000000,75000000,90000000,100000000)`;
    await observer`insert into operational_budget_evidence(id,idempotency_key,cycle_id,contract_version,
      provider,scope_kind,scope_id,scope_name,scope_metadata,currency,observed_at,actual_amount_microusd,
      projected_amount_microusd,measurements,cost_breakdown_microusd,rate_card,source_version,collected_by,reason)
      values('load-evidence','load-evidence','load-cycle',1,'test','project',${runId},'Isolated rehearsal','{}',
      'USD',now(),1,1,'{}','{}','{}','fixture@1','launch-load','Synthetic budget authority; not provider billing evidence')`;
    return { ...fixture, apps };
  } catch (error) {
    await fixture.cleanup();
    throw error;
  }
};
