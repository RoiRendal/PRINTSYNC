import { useEffect, useRef, useState } from 'react';
import { User, X } from 'lucide-react';
import { Input } from '../../../shared/components/ui';
import type { Customer } from '../types';

interface CustomerSelectorProps {
  customers: Customer[];
  customerId: string | null;
  customerName: string;
  onChange: (customerId: string | null, customerName: string) => void;
}

export function CustomerSelector({ customers, customerId, customerName, onChange }: CustomerSelectorProps) {
  const [query, setQuery] = useState(customerName);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(customerName);
  }, [customerName]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.phone.includes(query) ||
    c.email.toLowerCase().includes(query.toLowerCase())
  );

  const selectedCustomer = customerId ? customers.find((c) => c.id === customerId) : null;

  const handleSelect = (customer: Customer) => {
    onChange(customer.id, customer.name);
    setQuery(customer.name);
    setIsOpen(false);
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    setIsOpen(true);
    if (selectedCustomer && value !== selectedCustomer.name) {
      onChange(null, value);
    } else if (!selectedCustomer) {
      onChange(null, value);
    }
  };

  const handleClear = () => {
    onChange(null, '');
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <User className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-macos-purple" aria-hidden="true" />
        <Input
          fieldSize="sm"
          className="pl-8 pr-8 text-xs"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search or type new customer..."
          aria-label="Customer name"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-macos-text-muted hover:text-macos-text dark:text-zinc-500 dark:hover:text-zinc-300"
            aria-label="Clear customer"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>

      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-[var(--radius-card)] border bg-[var(--app-surface-raised)] dark:bg-[#1a1a1d]">
          {filtered.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => handleSelect(customer)}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-xs hover:bg-[var(--app-tint-purple)] dark:hover:bg-[var(--app-tint-purple)]"
            >
              <span className="font-bold text-macos-text dark:text-zinc-100">{customer.name}</span>
              {(customer.phone || customer.email) && (
                <span className="text-2xs text-macos-text-muted dark:text-zinc-400">
                  {customer.phone}{customer.phone && customer.email ? ' · ' : ''}{customer.email}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && query && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-card)] border bg-[var(--app-surface-raised)] px-3 py-2 text-xs text-macos-text-muted dark:bg-[#1a1a1d] dark:text-zinc-400">
          No matching customers. Type to create a new one.
        </div>
      )}

      {selectedCustomer && (
        <div className="mt-1.5 flex items-center gap-1.5 text-2xs font-bold text-macos-purple dark:text-purple-300">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-macos-purple" />
          Linked to customer record
        </div>
      )}
    </div>
  );
}
