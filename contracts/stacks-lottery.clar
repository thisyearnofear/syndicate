;; Stacks Lottery Contract
;; Simple lottery contract for Stacks Bitcoin L2
;; Compatible with sBTC token standard

;; Contract owner
(define-constant CONTRACT_OWNER tx-sender)

;; Error codes
(define-constant ERR_NOT_ENOUGH_SBTC (err u1001))
(define-constant ERR_NOT_CONTRACT_OWNER (err u1002))
(define-constant ERR_INVALID_TICKET_COUNT (err u1003))
(define-constant ERR_LOTTERY_CLOSED (err u1004))

;; Lottery state
(define-data-var lottery-open bool true)
(define-data-var total-tickets uint u0)
(define-data-var ticket-price uint u1) ;; 1 sBTC per ticket
(define-data-var lottery-end-block uint u0)

;; Ticket storage
(define-map tickets
  { ticket-id: uint }
  {
    owner: principal,
    purchase-block: uint,
    ticket-number: uint,
  }
)

;; Lottery statistics
(define-map lottery-stats
  { key: (string-ascii 20) }
  { value: uint }
)

;; Initialize lottery
(define-public (initialize-lottery (end-block uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_CONTRACT_OWNER)
    (var-set lottery-end-block end-block)
    (var-set total-tickets u0)
    (var-set lottery-open true)
    (ok true)
  )
)

;; Purchase tickets with sBTC
(define-public (purchase-tickets (ticket-count uint))
  (let (
    (total-cost (* ticket-count (var-get ticket-price)))
    (current-tickets (var-get total-tickets))
    (new-ticket-id (+ current-tickets u1))
  )
    (asserts! (> ticket-count u0) ERR_INVALID_TICKET_COUNT)
    (asserts! (var-get lottery-open) ERR_LOTTERY_CLOSED)
    
    ;; Check if lottery has ended
    (asserts! (< burn-block-height (var-get lottery-end-block)) ERR_LOTTERY_CLOSED)
    
    ;; Transfer sBTC from buyer to contract
    (try! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
      transfer total-cost tx-sender (as-contract tx-sender) none))
    
    ;; Mint tickets for buyer
    (map-set tickets 
      { ticket-id: new-ticket-id }
      {
        owner: tx-sender,
        purchase-block: burn-block-height,
        ticket-number: ticket-count,
      }
    )
    
    ;; Update total tickets
    (var-set total-tickets (+ current-tickets ticket-count))
    
    ;; Update lottery stats
    (map-set lottery-stats 
      { key: "total-tickets" }
      { value: (+ current-tickets ticket-count) }
    )
    (map-set lottery-stats 
      { key: "total-players" }
      { value: (+ (default-to u0 (get value (map-get? lottery-stats { key: "total-players" }))) u1) }
    )
    
    ;; Emit event
    (print {
      event: "ticket-purchased",
      buyer: tx-sender,
      ticket-count: ticket-count,
      total-cost: total-cost,
      ticket-id: new-ticket-id,
      total-tickets: (+ current-tickets ticket-count)
    })
    
    (ok new-ticket-id)
  )
)

;; Get ticket information
(define-read-only (get-ticket (ticket-id uint))
  (map-get? tickets { ticket-id: ticket-id })
)

;; Get lottery status
(define-read-only (get-lottery-status)
  {
    open: (var-get lottery-open),
    total-tickets: (var-get total-tickets),
    ticket-price: (var-get ticket-price),
    end-block: (var-get lottery-end-block),
    current-block: burn-block-height,
  }
)

;; Get lottery statistics
(define-read-only (get-lottery-stats)
  {
    total-tickets: (default-to u0 (get value (map-get? lottery-stats { key: "total-tickets" }))),
    total-players: (default-to u0 (get value (map-get? lottery-stats { key: "total-players" }))),
  }
)

;; Close lottery (only owner)
(define-public (close-lottery)
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_CONTRACT_OWNER)
    (var-set lottery-open false)
    (ok true)
  )
)

;; Withdraw funds (only owner)
(define-public (withdraw-funds)
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_CONTRACT_OWNER)
    
    ;; Get contract sBTC balance
    (let ((balance (unwrap-panic (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
      get-balance (as-contract tx-sender)))))
      
      (if (> balance u0)
        (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
          transfer balance (as-contract tx-sender) CONTRACT_OWNER none)
        (ok false)
      )
    )
  )
)

;; Draw winner (simplified - would need proper randomness in production)
(define-public (draw-winner)
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_CONTRACT_OWNER)
    (asserts! (not (var-get lottery-open)) ERR_LOTTERY_CLOSED)
    
    ;; Get total tickets for random selection
    (let ((total-tickets (var-get total-tickets)))
      (asserts! (> total-tickets u0) ERR_INVALID_TICKET_COUNT)
      
      ;; In a real implementation, this would use proper randomness
      ;; For now, return the first ticket as winner (simplified)
      (ok u1)
    )
  )
)

;; Get winner (placeholder)
(define-read-only (get-winner)
  ;; In a real implementation, this would return the winning ticket
  (ok none)
)