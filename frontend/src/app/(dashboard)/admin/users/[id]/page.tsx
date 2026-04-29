"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { adminApi } from '@/lib/api/admin';
import { User, Role } from '@/types/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, UserCircle, Activity } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';

const userSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role_id: z.coerce.number().min(1, "Role is required"),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function UserDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'Super Admin';
  
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema) as any,
    defaultValues: {
      name: '',
      email: '',
      role_id: undefined as any,
    },
  });

  const fetchData = async () => {
    try {
      const [userRes, rolesRes] = await Promise.all([
        adminApi.getUserById(id),
        adminApi.getRoles().catch(() => ({ success: true, data: [] }))
      ]);
      
      if (userRes.success && userRes.data) {
        setUser(userRes.data);
        form.reset({
          name: userRes.data.name,
          email: userRes.data.email,
          role_id: Number(userRes.data.role_id) || undefined as any,
        });
      }
      if (rolesRes.success) setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);
    } catch (error) {
      toast.error("Failed to fetch user details");
      router.push('/admin/users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin && id) fetchData();
  }, [id, isSuperAdmin, form]);

  const onSubmit = async (data: UserFormValues) => {
    setIsSaving(true);
    try {
      const res = await adminApi.updateUser(id, data);
      if (res.success) {
        toast.success("User updated successfully");
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update user");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const res = await adminApi.updateUserStatus(id, newStatus);
      if (res.success) {
        toast.success(`User status changed to ${newStatus}`);
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to change user status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePasswordReset = async () => {
    const newPassword = prompt("Enter new password for the user (min 8 chars, 1 uppercase, 1 lowercase, 1 number):");
    if (!newPassword) return;
    
    if (newPassword.length < 8 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      toast.error("Password does not meet complexity requirements.");
      return;
    }
    
    try {
      const res = await adminApi.updateUserPassword(id, { new_password: newPassword });
      if (res.success) toast.success("Password reset successfully");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to reset password");
    }
  };

  if (!isSuperAdmin) return <div className="p-8 text-center text-red-500 font-medium">Access Restricted</div>;
  if (isLoading) return <div className="p-8 text-center">Loading user details...</div>;
  if (!user) return <div className="p-8 text-center text-red-500">User not found</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/users"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit User</h1>
          <p className="text-slate-500">Manage account details, roles, and access.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="col-span-1 border-t-4 border-t-blue-600">
          <CardContent className="pt-6 text-center">
            <UserCircle className="w-24 h-24 mx-auto text-slate-300 mb-4" />
            <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
            <p className="text-sm text-slate-500 mb-4">{user.email}</p>
            
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-6">
              {user.role?.name}
            </div>

            <div className="space-y-3 pt-6 border-t">
              <Button 
                variant={user.status === 'ACTIVE' ? 'destructive' : 'outline'} 
                className={user.status === 'INACTIVE' ? 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200' : 'w-full'}
                onClick={() => handleStatusChange(user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                disabled={isUpdatingStatus}
              >
                <Activity className="w-4 h-4 mr-2" />
                {user.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
              </Button>
              
              <Button variant="outline" className="w-full" onClick={handlePasswordReset}>
                <KeyRound className="w-4 h-4 mr-2" />
                Reset Password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Update the user's basic profile and system role.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl><Input type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Role</FormLabel>
                      <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString() || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roles.map(r => (
                            <SelectItem key={r.role_id} value={r.role_id.toString()}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-4">
                  <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
