"use client";

import React, { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin';
import { Role } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Shield, Settings, Plus } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { hasPermission } from '@/lib/permissions';
import Link from 'next/link';

export default function RolesManagementPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { user: currentUser } = useAuthStore();
  
  if (!hasPermission(currentUser?.role, 'admin')) {
    return <div className="p-8 text-center text-red-500">Access Denied. You do not have permission to view administration pages.</div>;
  }
  const isSuperAdmin = currentUser?.role === 'Super Admin';

  useEffect(() => {
    const fetchRoles = async () => {
      setIsLoading(true);
      try {
        const res = await adminApi.getRoles();
        if (res.success) setRoles(res.data);
      } catch (error) {
        console.error("Failed to fetch roles", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isSuperAdmin) fetchRoles();
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return <div className="p-8 text-center text-red-500 font-medium">Access Restricted to Super Administrators.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Role & Permissions</h1>
          <p className="text-slate-500">Manage access levels for different staff types.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" asChild>
          <Link href="/admin/roles/new">
            <Plus className="mr-2 h-4 w-4" /> Add Role
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Roles</CardTitle>
          <CardDescription>Available roles and their base permissions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>System Permissions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-slate-500">
                      Loading roles...
                    </TableCell>
                  </TableRow>
                ) : roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-slate-500">
                      No roles defined in the system.
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((r) => (
                    <TableRow key={r.role_id}>
                      <TableCell className="font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-indigo-500" />
                          {r.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{r.description}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.permissions && r.permissions.slice(0, 3).map((p: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px] bg-slate-50">
                              {typeof p === 'string' ? p : p.action || 'permission'}
                            </Badge>
                          ))}
                          {r.permissions && r.permissions.length > 3 && (
                            <Badge variant="outline" className="text-[10px] bg-slate-100">+{r.permissions.length - 3} more</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/roles/${r.role_id}`}>
                            <Settings className="h-4 w-4 mr-2" /> Manage
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
