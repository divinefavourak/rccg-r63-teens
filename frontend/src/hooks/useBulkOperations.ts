import { useState } from 'react';
import { emailService } from '../utils/emailService';
import { ticketService } from '../services/ticketService';
import { EVENT_DETAILS } from '../constants/eventDetails';
import { type Ticket, type OperationResult } from '../types';

export const useBulkOperations = (
  tickets: Ticket[],
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>
) => {
  // ✅ FIX 1: Change generic type from <number> to <string>
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const [operationResults, setOperationResults] = useState<OperationResult | null>(null);

  // Select all tickets
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedTickets(new Set(tickets.map(ticket => ticket.id)));
    } else {
      setSelectedTickets(new Set());
    }
  };

  // Select individual ticket
  // ✅ FIX 2: Change parameter type to string
  const handleSelectTicket = (ticketId: string, checked: boolean) => {
    const newSelected = new Set(selectedTickets);
    if (checked) {
      newSelected.add(ticketId);
    } else {
      newSelected.delete(ticketId);
    }
    setSelectedTickets(newSelected);
  };

  // Bulk actions
  const handleBulkAction = async () => {
    if (!bulkAction || selectedTickets.size === 0) return;

    setIsProcessing(true);
    setOperationResults(null);

    const selectedTicketsData = tickets.filter(ticket => selectedTickets.has(ticket.id));

    try {
      let results: OperationResult = {
        action: bulkAction,
        total: selectedTickets.size,
        successful: 0,
        failed: 0,
        details: []
      };

      const ticketIds = Array.from(selectedTickets);

      switch (bulkAction) {
        case "approve":
          setTickets(prev => prev.map(ticket =>
            selectedTickets.has(ticket.id) ? { ...ticket, status: "approved" } : ticket
          ));

          const approvalResponse = await ticketService.performBulkAction(ticketIds, 'approve');

          results.successful = approvalResponse.successful.length;
          results.failed = approvalResponse.failed.length;
          results.details = [
            ...approvalResponse.successful.map((id: string) => {
              const t = selectedTicketsData.find(x => x.id === id);
              return { success: true, recipient: t?.email, name: t?.fullName };
            }),
            ...approvalResponse.failed.map((f: any) => {
              const t = selectedTicketsData.find(x => x.id === f.id);
              return { success: false, recipient: t?.email, name: t?.fullName, error: f.error };
            })
          ];
          break;

        case "reject":
          setTickets(prev => prev.map(ticket =>
            selectedTickets.has(ticket.id) ? { ...ticket, status: "rejected" } : ticket
          ));

          const rejectionResponse = await ticketService.performBulkAction(ticketIds, 'reject');

          results.successful = rejectionResponse.successful.length;
          results.failed = rejectionResponse.failed.length;
          results.details = [
            ...rejectionResponse.successful.map((id: string) => {
              const t = selectedTicketsData.find(x => x.id === id);
              return { success: true, recipient: t?.email, name: t?.fullName };
            }),
            ...rejectionResponse.failed.map((f: any) => {
              const t = selectedTicketsData.find(x => x.id === f.id);
              return { success: false, recipient: t?.email, name: t?.fullName, error: f.error };
            })
          ];
          break;

        case "delete":
          setTickets(prev => prev.filter(ticket => !selectedTickets.has(ticket.id)));

          // Call backend delete
          const deleteResponse = await ticketService.performBulkAction(ticketIds, 'delete');

          results.successful = deleteResponse.successful.length;
          results.failed = deleteResponse.failed.length;
          results.details = selectedTicketsData.map(t => ({
            success: true,
            recipient: t.email,
            name: t.fullName,
            action: 'deleted'
          }));
          break;

        case "send_reminder":
          const template = emailService.templates.reminder('Participant', 'BULK', EVENT_DETAILS);
          const reminderResponse = await ticketService.performBulkAction(
            ticketIds,
            'send_email',
            template.subject,
            template.message
          );

          results.successful = reminderResponse.successful.length;
          results.failed = reminderResponse.failed.length;
          results.details = [
            ...reminderResponse.successful.map((id: string) => {
              const t = selectedTicketsData.find(x => x.id === id);
              return { success: true, recipient: t?.email, name: t?.fullName };
            }),
            ...reminderResponse.failed.map((f: any) => {
              const t = selectedTicketsData.find(x => x.id === f.id);
              return { success: false, recipient: t?.email, name: t?.fullName, error: f.error };
            })
          ];
          break;
      }

      setOperationResults(results);
      setSelectedTickets(new Set());
      setBulkAction('');

    } catch (error: any) {
      setOperationResults({
        action: bulkAction,
        total: selectedTickets.size,
        successful: 0,
        failed: selectedTickets.size,
        error: error.message || "An unknown error occurred",
        details: []
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const sendCustomEmail = async (subject: string, message: string, recipientType = 'selected') => {
    setIsProcessing(true);
    setOperationResults(null);

    let recipients: Ticket[] = [];

    switch (recipientType) {
      case 'selected':
        recipients = tickets.filter(t => selectedTickets.has(t.id));
        break;
      case 'pending':
        recipients = tickets.filter(t => t.status === 'pending');
        break;
      case 'approved':
        recipients = tickets.filter(t => t.status === 'approved');
        break;
      case 'all':
        recipients = tickets;
        break;
    }

    try {
      // Map ticket objects to IDs
      const ticketIds = recipients.map(t => t.id);

      const response = await ticketService.performBulkAction(ticketIds, 'send_email', subject, message);

      setOperationResults({
        action: 'custom_email',
        total: recipients.length,
        successful: response.successful.length,
        failed: response.failed.length,
        details: [
          ...response.successful.map((id: string) => {
            const t = recipients.find(x => x.id === id);
            return { success: true, recipient: t?.email, name: t?.fullName };
          }),
          ...response.failed.map((f: any) => {
            const t = recipients.find(x => x.id === f.id);
            return { success: false, recipient: t?.email, name: t?.fullName, error: f.error };
          })
        ]
      });

    } catch (error: any) {
      setOperationResults({
        action: 'custom_email',
        total: recipients.length,
        successful: 0,
        failed: recipients.length,
        error: error.message || "An unknown error occurred",
        details: []
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    selectedTickets,
    setSelectedTickets,
    bulkAction,
    setBulkAction,
    isProcessing,
    operationResults,
    setOperationResults,
    handleSelectAll,
    handleSelectTicket,
    handleBulkAction,
    sendCustomEmail
  };
};