"use client";

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { dashboardApi } from '@/lib/api/dashboard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, CalendarDays, DollarSign, Clock, Stethoscope, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await dashboardApi.getDashboardData();
        if (response.success) {
          const { success, message, data: nestedData, ...rest } = response as any;
          setData(nestedData || rest);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-slate-200 animate-pulse rounded"></div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-slate-200 animate-pulse rounded-xl"></div>
          ))}
        </div>
        <div className="h-96 bg-slate-200 animate-pulse rounded-xl"></div>
      </div>
    );
  }

  const isDoctor = user?.role === 'Doctor';

  if (isDoctor) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome, Dr. {user?.name}</h1>
          <p className="text-slate-500">Here's your schedule for today.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Today's Appointments</CardTitle>
              <CalendarDays className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.personal_stats?.appointments_today || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.personal_stats?.pending_appointments || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Completed</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.personal_stats?.completed_appointments || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Next Appointment</CardTitle>
            </CardHeader>
            <CardContent>
              {data.next_appointment ? (
                <div className="flex flex-col space-y-2">
                  <span className="text-lg font-semibold">{data.next_appointment.patient.name}</span>
                  <span className="text-sm text-slate-500">Queue: {data.next_appointment.queue_number} • Time: {data.next_appointment.slot_time}</span>
                  <span className="text-sm text-slate-500">Status: {data.next_appointment.status}</span>
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No upcoming appointments today.</p>
              )}
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Today's Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              {data.my_sessions_today && data.my_sessions_today.length > 0 ? (
                <div className="space-y-4">
                  {data.my_sessions_today.map((s: any) => (
                    <div key={s.session_id} className="flex justify-between items-center border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{s.start_time} - {s.end_time}</p>
                        <p className="text-xs text-slate-500">{s.branch.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{s.booked_count} / {s.max_patients} Booked</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${s.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                          {s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No sessions scheduled for today.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Admin/Receptionist/Accountant View
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Hospital Overview</h1>
        <p className="text-slate-500">Today's summary across all branches.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Appointments Today</CardTitle>
            <CalendarDays className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.today?.total_appointments || 0}</div>
            <p className="text-xs text-slate-500">
              {data.today?.completed_appointments || 0} completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Active Patients</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.this_month?.total_patients || 0}</div>
            <p className="text-xs text-green-600">
              +{data.this_month?.new_patients_this_month || 0} new this month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Active Sessions</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.active_sessions_today?.length || 0}</div>
            <p className="text-xs text-slate-500">Open & running today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Revenue Today</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">LKR {data.today?.total_revenue?.toLocaleString() || 0}</div>
            <p className="text-xs text-slate-500">Collected</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Revenue & Appointment Trend (This Month)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={(val) => new Date(val).getDate().toString()} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} />
                  <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue (LKR)" />
                  <Bar yAxisId="right" dataKey="appointments" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Appointments" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Doctors</CardTitle>
            <CardDescription>By completed appointments this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.top_doctors_this_month?.map((doc: any, i: number) => (
                <div key={doc.doctor_id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-none">{doc.name}</p>
                      <p className="text-xs text-slate-500">{doc.specialization}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{doc.completed_appointments}</p>
                    <p className="text-xs text-slate-500">Appts</p>
                  </div>
                </div>
              ))}
              {(!data.top_doctors_this_month || data.top_doctors_this_month.length === 0) && (
                <p className="text-sm text-slate-500">No data available yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
