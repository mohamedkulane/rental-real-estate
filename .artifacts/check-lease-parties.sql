SELECT l.lead_number, l.display_name AS lead_name, l.party_id AS lead_party_id,
       p1.display_name AS lead_party_name,
       a.application_number, ap.display_name AS applicant_name,
       lp.role, p2.display_name AS lease_party_name
FROM leads l
LEFT JOIN parties p1 ON p1.id = l.party_id
LEFT JOIN rental_applications a ON a.lead_id = l.id
LEFT JOIN parties ap ON ap.id = a.applicant_party_id
LEFT JOIN leases le ON le.application_id = a.id
LEFT JOIN lease_parties lp ON lp.lease_id = le.id
LEFT JOIN parties p2 ON p2.id = lp.party_id
WHERE l.lead_number = 'LEAD-000001'
   OR a.application_number = 'APP-000001'
   OR le.lease_number = 'LSE-000001'
ORDER BY l.lead_number, lp.role;

SELECT pr.property_code, pr.name AS property_name,
       op.owner_number, p.display_name AS owner_name, po.ownership_percentage
FROM property_ownerships po
JOIN properties pr ON pr.id = po.property_id
JOIN owner_profiles op ON op.party_id = po.owner_party_id
JOIN parties p ON p.id = po.owner_party_id
JOIN rentable_spaces rs ON rs.property_id = pr.id
WHERE rs.space_code = 'APR-405';
