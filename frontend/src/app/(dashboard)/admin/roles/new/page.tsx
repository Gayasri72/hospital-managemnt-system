"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { adminApi } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';

const roleSchema = z.object({
  name: z.string().min(3, "Role name must be at least 3 characters"),
  description: z.string().optional().or(z.literal('')),
  permission_ids: z.array(z.number()).min(1, "At least one permission must be selected"),
});

type RoleFormValues = z.infer<typeof roleSchema>;

export default function AddRolePage() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'Super Admin';
  
  const [permissions, setPermissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      description: '',
      permission_ids: [],
    },
  });

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const res = await adminApi.getPermissions();
        if (res.success) setPermissions(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        toast.error("Failed to load permissions");
      }
    };
    if (isSuperAdmin) fetchPermissions();
  }, [isSuperAdmin]);

  const onSubmit = async (data: RoleFormValues) => {
    setIsLoading(true);
    try {
      const res = await adminApi.createRole(data);
      if (res.success) {
        toast.success("Role created successfully");
        router.push('/admin/roles');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create role");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSuperAdmin) return <div className="p-8 text-center text-red-500 font-medium">Access Restricted</div>;

  // Group permissions by resource
  const groupedPermissions = permissions.reduce((acc, p) => {
    const resource = p.resource || 'General';
    if (!acc[resource]) acc[resource] = [];
    acc[resource].push(p);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/roles"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add New Role</h1>
          <p className="text-slate-500">Define a new system role and its permissions.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Role Information</CardTitle>
              <CardDescription>Basic details about this role.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. Nurse Practitioner" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="What does this role do?" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Permissions *</CardTitle>
              <CardDescription>Select what features users with this role can access.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="permission_ids"
                render={() => (
                  <FormItem>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Object.keys(groupedPermissions).length === 0 && (
                        <div className="text-slate-500 col-span-full">Loading permissions...</div>
                      )}
                      {(Object.entries(groupedPermissions) as [string, any[]][]).map(([resource, perms]) => (
                        <div key={resource} className="bg-slate-50 p-4 rounded-lg border">
                          <h3 className="font-semibold text-slate-800 mb-3 capitalize">{resource} Management</h3>
                          <div className="space-y-2">
                            {perms.map((permission) => (
                              <FormField
                                key={permission.permission_id}
                                control={form.control}
                                name="permission_ids"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={permission.permission_id}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(permission.permission_id)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, permission.permission_id])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== permission.permission_id
                                                  )
                                                )
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal text-sm capitalize">
                                        {permission.action} {permission.resource}
                                      </FormLabel>
                                    </FormItem>
                                  )
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <FormMessage className="mt-4" />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Role"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
