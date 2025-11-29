// frontend/src/hooks/useBulkOperations.ts
import { useState } from 'react';
import { emailService } from '../utils/emailService';
import { EVENT_DETAILS } from '../constants/eventDetails';
import { Ticket, OperationResult } from '../types';

export const useBulkOperations = (
  tickets: Ticket[], 
  setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>
) => {
  // Explicitly type the state to allow number values (Ticket IDs)
  const [selectedTickets, setSelectedTickets] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // FIX: Explicitly type this state so it can hold the result object or null
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
  const handleSelectTicket = (ticketId: number, checked: boolean) => {
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

    // Filter to get the full ticket objects for the selected IDs
    const selectedTicketsData = tickets.filter(ticket => selectedTickets.has(ticket.id));

    try {
      // Initialize results with the OperationResult interface
      let results: OperationResult = {
        action: bulkAction,
        total: selectedTickets.size,
        successful: 0,
        failed: 0,
        details: []
      };

      switch (bulkAction) {
        case "approve":
          // Update tickets status in local state
          setTickets(prev => prev.map(ticket =>
            selectedTickets.has(ticket.id) ? { ...ticket, status: "approved" } : ticket
          ));
          
          // Send approval emails
          const approvalResults = await emailService.sendBulkEmails(
            selectedTicketsData.map(t => ({ id: t.id, email: t.email, name: t.fullName })),
            emailService.templates.approval('Participant', 'BULK', EVENT_DETAILS).subject,
            emailService.templates.approval('Participant', 'BULK', EVENT_DETAILS).message
          );
          
          results.successful = approvalResults.successful;
          results.failed = approvalResults.failed;
          results.details = approvalResults.results;
          break;

        case "reject":
          // Update tickets status in local state
          setTickets(prev => prev.map(ticket =>
            selectedTickets.has(ticket.id) ? { ...ticket, status: "rejected" } : ticket
          ));
          
          // Send rejection emails
          const rejectionResults = await emailService.sendBulkEmails(
            selectedTicketsData.map(t => ({ id: t.id, email: t.email, name: t.fullName })),
            emailService.templates.rejection('Participant', 'BULK', EVENT_DETAILS).subject,
            emailService.templates.rejection('Participant', 'BULK', EVENT_DETAILS).message
          );
          
          results.successful = rejectionResults.successful;
          results.failed = rejectionResults.failed;
          results.details = rejectionResults.results;
          break;

        case "delete":
          // Remove tickets from local state
          setTickets(prev => prev.filter(ticket => !selectedTickets.has(ticket.id)));
          
          results.successful = selectedTickets.size;
          results.details = selectedTicketsData.map(t => ({
            success: true,
            recipient: t.email,
            name: t.fullName,
            action: 'deleted'
          }));
          break;

        case "send_reminder":
          // Send reminder emails
          const reminderResults = await emailService.sendBulkEmails(
            selectedTicketsData.map(t => ({ id: t.id, email: t.email, name: t.fullName })),
            emailService.templates.reminder('Participant', 'BULK', EVENT_DETAILS).subject,
            emailService.templates.reminder('Participant', 'BULK', EVENT_DETAILS).message
          );
          
          results.successful = reminderResults.successful;
          results.failed = reminderResults.failed;
          results.details = reminderResults.results;
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

  // Send custom email to selected tickets
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
      const results = await emailService.sendBulkEmails(
        recipients.map(t => ({ id: t.id, email: t.email, name: t.fullName })),
        subject,
        message
      );

      setOperationResults({
        action: 'custom_email',
        total: recipients.length,
        successful: results.successful,
        failed: results.failed,
        details: results.results
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