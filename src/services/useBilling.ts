import { useEffect, useState } from 'react';
import {
  subscribeToMonthlyPayments,
  subscribeToAllPayments,
  subscribeToGroups,
  subscribeToMemberships,
} from '../firebase';
import type { Group, GroupMembership, StudentPaymentRecord } from '../types';

/** Live payment records of one month (Cairo month key, YYYY-MM). */
export function useMonthlyPaymentRecords(
  teacherId: string | undefined,
  monthKey: string,
  enabled = true
): StudentPaymentRecord[] {
  const [records, setRecords] = useState<StudentPaymentRecord[]>([]);
  useEffect(() => {
    if (!enabled || !teacherId) return;
    const unsub = subscribeToMonthlyPayments(teacherId, monthKey, setRecords);
    return () => unsub();
  }, [teacherId, monthKey, enabled]);
  return records;
}

/** Live payment records of every month (used by the financial dashboard). */
export function useAllPaymentRecords(teacherId: string | undefined, enabled = true): StudentPaymentRecord[] {
  const [records, setRecords] = useState<StudentPaymentRecord[]>([]);
  useEffect(() => {
    if (!enabled || !teacherId) return;
    const unsub = subscribeToAllPayments(teacherId, setRecords);
    return () => unsub();
  }, [teacherId, enabled]);
  return records;
}

/** Live groups + memberships (needed to know each student's fee and join date). */
export function useGroupsAndMemberships(
  teacherId: string | undefined,
  enabled = true
): { groups: Group[]; memberships: GroupMembership[] } {
  const [groups, setGroups] = useState<Group[]>([]);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  useEffect(() => {
    if (!enabled || !teacherId) return;
    const u1 = subscribeToGroups(teacherId, setGroups);
    const u2 = subscribeToMemberships(teacherId, setMemberships);
    return () => {
      u1();
      u2();
    };
  }, [teacherId, enabled]);
  return { groups, memberships };
}
