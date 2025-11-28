import { useState } from 'react';
import { emailService } from '../utils/emailService';
import { EVENT_DETAILS } from '../constants/eventDetails';

export const useBulkOperations = (tickets, setTickets) => {
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationResults, setOperationResults] = useState(null);

  // Select all tickets
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedTickets(new Set(tickets.map(ticket => ticket.id)));
    } else {
      setSelectedTickets(new Set());
    }
  };

  // Select individual ticket
  const handleSelectTicket = (ticketId, checked) => {
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

    const ticketIds = Array.from(selectedTickets);
    const selectedTicketsData = tickets.filter(ticket => selectedTickets.has(ticket.id));

    try {
      let results = {
        action: bulkAction,
        total: selectedTickets.size,
        successful: 0,
        failed: 0,
        details: []
      };

      switch (bulkAction) {
        case "approve":
          // Update tickets status
          setTickets(prev => prev.map(ticket =>
            selectedTickets.has(ticket.id) ? { ...ticket, status: "approved" } : ticket
          ));
          
          // Send approval emails
          const approvalResults = await emailService.sendBulkEmails(
            selectedTicketsData.map(t => ({ id: t.id, email: t.email, name: t.fullName })),
            emailService.templates.approval('Participant', t.ticketId, EVENT_DETAILS).subject,
            emailService.templates.approval(t.fullName, t.ticketId, EVENT_DETAILS).message
          );
          
          results.successful = approvalResults.successful;
          results.failed = approvalResults.failed;
          results.details = approvalResults.results;
          break;

        case "reject":
          // Update tickets status
          setTickets(prev => prev.map(ticket =>
            selectedTickets.has(ticket.id) ? { ...ticket, status: "rejected" } : ticket
          ));
          
          // Send rejection emails
          const rejectionResults = await emailService.sendBulkEmails(
            selectedTicketsData.map(t => ({ id: t.id, email: t.email, name: t.fullName })),
            emailService.templates.rejection('Participant', t.ticketId, EVENT_DETAILS).subject,
            emailService.templates.rejection(t.fullName, t.ticketId, EVENT_DETAILS).message
          );
          
          results.successful = rejectionResults.successful;
          results.failed = rejectionResults.failed;
          results.details = rejectionResults.results;
          break;

        case "delete":
          // Remove tickets
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
            emailService.templates.reminder('Participant', t.ticketId, EVENT_DETAILS).subject,
            emailService.templates.reminder(t.fullName, t.ticketId, EVENT_DETAILS).message
          );
          
          results.successful = reminderResults.successful;
          results.failed = reminderResults.failed;
          results.details = reminderResults.results;
          break;
      }

      setOperationResults(results);
      setSelectedTickets(new Set());
      setBulkAction('');

    } catch (error) {
      setOperationResults({
        action: bulkAction,
        total: selectedTickets.size,
        successful: 0,
        failed: selectedTickets.size,
        error: error.message,
        details: []
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Send custom email to selected tickets
  const sendCustomEmail = async (subject, message, recipientType = 'selected') => {
    setIsProcessing(true);
    setOperationResults(null);

    let recipients = [];
    
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

    } catch (error) {
      setOperationResults({
        action: 'custom_email',
        total: recipients.length,
        successful: 0,
        failed: recipients.length,
        error: error.message,
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