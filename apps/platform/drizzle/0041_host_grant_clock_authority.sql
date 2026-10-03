-- airjam:migration-mode=online
-- airjam:verify=table:realtime_host_grant_consumptions
-- airjam:verify=absent-constraint:realtime_host_grant_consumptions.realtime_host_grant_consumptions_chronology_check
-- Grant expiry uses the issuer clock; consumption uses the database clock.
ALTER TABLE "realtime_host_grant_consumptions" DROP CONSTRAINT "realtime_host_grant_consumptions_chronology_check";
