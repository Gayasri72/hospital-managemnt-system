"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart3, PieChart, Users, TrendingUp, DollarSign, CalendarDays, Activity } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { hasPermission } from '@/lib/permissions';

export default function ReportsIndexPage() {
  const { user } = useAuthStore();
  
  const canViewFinancials = hasPermission(user?.role, 'reports');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reports & Analytics</h1>
          <p className="text-slate-500">Access comprehensive data and insights for the hospital.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Financial Reports - Restricted */}
        {canViewFinancials && (
          <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => window.location.href = '/reports/revenue'}>
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <DollarSign className="w-6 h-6" />
              </div>
              <CardTitle>Revenue Reports</CardTitle>
              <CardDescription>Financial analytics, income breakdown, and trends.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="w-full justify-between text-green-700 hover:text-green-800 hover:bg-green-50" asChild>
                <Link href="/reports/revenue">
                  View Revenue Dashboard <TrendingUp className="w-4 h-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Operational Reports */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => window.location.href = '/reports/appointments'}>
          <CardHeader className="pb-3">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <CalendarDays className="w-6 h-6" />
            </div>
            <CardTitle>Appointment Analytics</CardTitle>
            <CardDescription>Booking volumes, completion rates, and patient flow.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" className="w-full justify-between text-blue-700 hover:text-blue-800 hover:bg-blue-50" asChild>
              <Link href="/reports/appointments">
                View Appointment Data <BarChart3 className="w-4 h-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Staff Reports */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => window.location.href = '/reports/doctors'}>
          <CardHeader className="pb-3">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
            <CardTitle>Doctor Performance</CardTitle>
            <CardDescription>Session loads, patient counts, and revenue by doctor.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" className="w-full justify-between text-purple-700 hover:text-purple-800 hover:bg-purple-50" asChild>
              <Link href="/reports/doctors">
                View Staff Metrics <Users className="w-4 h-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        
        {/* Coming Soon */}
        <Card className="border-dashed bg-slate-50 opacity-70">
          <CardHeader className="pb-3">
            <div className="w-12 h-12 bg-slate-200 text-slate-500 rounded-lg flex items-center justify-center mb-4">
              <PieChart className="w-6 h-6" />
            </div>
            <CardTitle>Inventory Reports</CardTitle>
            <CardDescription>Pharmacy and medical supplies tracking.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Coming Soon</Badge>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
