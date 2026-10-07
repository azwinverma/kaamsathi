"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { qk } from "../keys";
import type { CalendarDay, CalendarMonth, District, MinimumWage, Province, Trade } from "../types";

const DAY = 24 * 60 * 60 * 1000;

export function useProvinces() {
  return useQuery({
    queryKey: qk.ref.provinces,
    queryFn: () => api.get<Province[]>("/ref/provinces"),
    staleTime: DAY,
  });
}

export function useDistricts(province?: number | string | null) {
  return useQuery({
    queryKey: qk.ref.districts(province),
    queryFn: () => api.get<District[]>("/ref/districts", province ? { province } : undefined),
    staleTime: DAY,
  });
}

export function useTrades() {
  return useQuery({
    queryKey: qk.ref.trades,
    queryFn: () => api.get<Trade[]>("/ref/trades"),
    staleTime: DAY,
  });
}

export function useMinimumWage() {
  return useQuery({
    queryKey: qk.ref.minimumWage,
    queryFn: () => api.get<MinimumWage>("/ref/minimum-wage"),
    staleTime: DAY,
  });
}

export function useCalendarToday() {
  return useQuery({
    queryKey: qk.ref.today,
    queryFn: () => api.get<CalendarDay>("/ref/calendar/today"),
    staleTime: 60 * 60 * 1000,
  });
}

export function useCalendarMonth(bsYear: number, bsMonth: number, enabled = true) {
  return useQuery({
    queryKey: qk.ref.month(bsYear, bsMonth),
    queryFn: () => api.get<CalendarMonth>("/ref/calendar/month", { bs_year: bsYear, bs_month: bsMonth }),
    staleTime: DAY,
    enabled,
  });
}
