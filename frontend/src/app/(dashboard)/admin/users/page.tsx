"use client";

import React, { useEffect, useState } from 'react';
import { adminApi } from '@/lib/api/admin';
import { User, Role } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, UserCircle, Shield, Edit2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { hasPermission } from '@/lib/permissions';
import Link from 'next/link';

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  
  const { user: currentUser } = useAuthStore();

  if (!hasPermission(currentUser?.role, 'admin')) {
    return <div className="p-8 text-center text-red-500">Access Denied. You do not have permission to view administration pages.</div>;
  }
  const isSuperAdmin = currentUser?.role === 'Super Admin';

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [usersRes, rolesRes] = await Promise.all([
          adminApi.getUsers({ search, role_id: roleFilter !== 'all' ? roleFilter : undefined }),
          adminApi.getRoles().catch(() => ({ success: true, data: [] }))
        ]);
        
        if (usersRes.success) {
          const dataArray = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data?.items || []);
          setUsers(dataArray);
        }
        if (rolesRes.success) setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);
      } catch (error) {
        console.error("Failed to fetch admin data", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isSuperAdmin) {
      const timer = setTimeout(fetchData, 300);
      return () => clearTimeout(timer);
    }
  }, [search, roleFilter, isSuperAdmin]);

  if (!isSuperAdmin) {
    return <div className="p-8 text-center text-red-500 font-medium">Access Restricted to Super Administrators.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h1>
          <p className="text-slate-500">Manage hospital staff accounts and system access.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" asChild>
          <Link href="/admin/users/new">
            <Plus className="mr-2 h-4 w-4" /> Add User
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
          <CardDescription>All registered accounts in the hospital platform.</CardDescription>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative w-full sm:w-1/2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                type="search"
                placeholder="Search users..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-1/4">
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v || 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map(r => (
                    <SelectItem key={r.role_id} value={String(r.role_id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-slate-500">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24 text-slate-500">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserCircle className="h-8 w-8 text-slate-300" />
                          <div>
                            <p className="font-medium text-slate-900">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Shield className="h-3 w-3 mr-1 text-blue-500" />
                          <span className="text-sm">{u.role?.name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.status === 'ACTIVE' ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/admin/users/${u.user_id}`}>
                            <Edit2 className="h-4 w-4 mr-2" /> Edit
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
