"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { LogOut, User, ShieldAlert, Menu } from "lucide-react"

export function Navbar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Check for mobile on client side only
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // Initial check
    checkMobile()

    // Add event listener for resize
    window.addEventListener("resize", checkMobile)

    // Cleanup
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const isActive = pathname === href
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2",
          isActive
            ? "border-amber-500 text-gray-900"
            : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
        )}
      >
        {children}
      </Link>
    )
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Mobile Menu Button */}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-700 md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Menu"
            >
              <Menu className="h-6 w-6" />
            </Button>
          )}

          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <span className="font-bold text-navy-700 text-lg sm:text-xl">
                Break Bread <span className="text-amber-600">Business Group</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <NavLink href="/dashboard">Dashboard</NavLink>
            <NavLink href="/lenders">Lender Management</NavLink>

            {/* Admin Section */}
            {user?.isAdmin && (
              <NavLink href="/admin/users">
                <ShieldAlert className="h-4 w-4 mr-1" />
                User Admin
              </NavLink>
            )}

            {user && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center text-sm text-gray-700">
                  <User className="h-4 w-4 mr-1" />
                  <span className="max-w-[150px] truncate">{user.email}</span>
                  {user.isAdmin && (
                    <span className="ml-1 bg-purple-100 text-purple-800 text-xs px-1.5 py-0.5 rounded-full">Admin</span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={signOut} className="text-gray-600">
                  <LogOut className="h-4 w-4 mr-1" />
                  Logout
                </Button>
              </div>
            )}
          </div>

          {/* Mobile User Info/Logout */}
          {isMobile && user && (
            <Button variant="ghost" size="sm" onClick={signOut} className="text-gray-600 md:hidden">
              <LogOut className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Mobile Menu */}
        {isMobile && isMenuOpen && (
          <div className="md:hidden border-t border-gray-200">
            <div className="py-2">
              <Link
                href="/dashboard"
                className={cn(
                  "block px-4 py-3 text-base font-medium",
                  pathname === "/dashboard" ? "bg-amber-50 text-amber-700" : "text-gray-600 hover:bg-gray-50",
                )}
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/lenders"
                className={cn(
                  "block px-4 py-3 text-base font-medium",
                  pathname === "/lenders" ? "bg-amber-50 text-amber-700" : "text-gray-600 hover:bg-gray-50",
                )}
                onClick={() => setIsMenuOpen(false)}
              >
                Lender Management
              </Link>
              {user?.isAdmin && (
                <Link
                  href="/admin/users"
                  className={cn(
                    "block px-4 py-3 text-base font-medium",
                    pathname === "/admin/users" ? "bg-amber-50 text-amber-700" : "text-gray-600 hover:bg-gray-50",
                  )}
                  onClick={() => setIsMenuOpen(false)}
                >
                  <div className="flex items-center">
                    <ShieldAlert className="h-4 w-4 mr-2" />
                    User Admin
                  </div>
                </Link>
              )}
              {user && (
                <div className="px-4 py-3 border-t border-gray-200 mt-2">
                  <div className="flex items-center text-sm text-gray-700 mb-2">
                    <User className="h-4 w-4 mr-2" />
                    <span className="truncate">{user.email}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
