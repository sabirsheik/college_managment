import {
  createResourceRecord, deleteResourceRecord, getResourceRecord,
  listResourceRecords, updateResourceRecord, getResource
} from '../services/resourceService.js';
import { writeAudit } from '../utils/audit.js';
import { HttpError } from '../utils/httpError.js';

function parseId(value) {
  if (!/^[1-9]\d*$/.test(value)) throw new HttpError(400, 'ID must be a positive integer.');
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw new HttpError(400, 'ID must be a positive integer.');
  return id;
}

export async function list(req, res) {
  const result = await listResourceRecords(req.params.resource, req.query);
  res.json({ success: true, message: 'Records fetched successfully.', ...result });
}

export async function get(req, res) {
  res.json({
    success: true,
    message: 'Record fetched successfully.',
    data: await getResourceRecord(req.params.resource, parseId(req.params.id))
  });
}

export async function create(req, res) {
  const resource = getResource(req.params.resource);
  const record = await createResourceRecord(req.params.resource, req.body);
  await writeAudit(req, 'CREATE', resource.table, record.id);
  res.status(201).json({ success: true, message: 'Record created successfully.', data: record });
}

export async function update(req, res) {
  const resource = getResource(req.params.resource);
  const id = parseId(req.params.id);
  const record = await updateResourceRecord(req.params.resource, id, req.body);
  const action = req.body?.status === 'ACTIVE' ? 'ACTIVATE'
    : req.body?.status === 'INACTIVE' ? 'DEACTIVATE' : 'UPDATE';
  await writeAudit(req, action, resource.table, id);
  res.json({ success: true, message: 'Record updated successfully.', data: record });
}

export async function remove(req, res) {
  const resource = getResource(req.params.resource);
  const id = parseId(req.params.id);
  await deleteResourceRecord(req.params.resource, id);
  await writeAudit(req, 'DELETE', resource.table, id);
  res.json({ success: true, message: 'Record deleted successfully.', data: null });
}
