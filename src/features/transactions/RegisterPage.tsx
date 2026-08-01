import type { MonthKey } from '../../domain/models';
import type { TransactionRepository } from '../../data/repositories/transactionRepository';
import { TransactionForm } from './TransactionForm';
import { type TransactionMasterData } from './transactionModel';

interface RegisterPageProps {
  repository: TransactionRepository;
  masterData: TransactionMasterData;
  onRegistered: (monthKey: MonthKey) => void;
}

export function RegisterPage({
  repository,
  masterData,
  onRegistered,
}: RegisterPageProps): React.JSX.Element {
  return (
    <section className="form-card">
      <div className="section-heading">
        <div>
          <p className="kicker">NEW TRANSACTION</p>
          <h2>収支を登録</h2>
        </div>
      </div>
      <TransactionForm
        masterData={masterData}
        onSubmit={async (input) => {
          const transaction = await repository.create(input);
          onRegistered(transaction.date.slice(0, 7) as MonthKey);
        }}
      />
    </section>
  );
}
