import React, { useState } from 'react';
import { ExternalLink, PlusCircle, Search, X } from 'react-feather';
import Modal from 'react-modal';

import { Button } from './components/button';
import ActionButton from './ActionButton';
import {
  DegreeEnhancement,
  degreeEnhancements,
  enhancementProgress,
} from './degreeEnhancements';
import { Plan } from './plannerData';

interface Props {
  plans?: DegreeEnhancement[];
  selected: string[];
  plan: Plan;
  onToggle: (id: string) => void;
}

const DegreeEnhancementPicker = ({
  selected,
  plans = degreeEnhancements,
  plan,
  onToggle,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('all');
  const [preview, setPreview] = useState(plans[0]?.id ?? '');
  const matches = plans.filter(
    (item) =>
      (kind === 'all' || item.kind === kind) &&
      item.title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const current = matches.find((item) => item.id === preview) ?? matches[0];
  const coverage = current ? enhancementProgress(current, plan) : null;
  return (
    <section
      className="mb-lg rounded-xl border border-solid border-light3 bg-white p-md"
      aria-label="Minors and specializations"
    >
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <h2 className="m-0 text-sm font-semibold">Minors & specializations</h2>
        <Button
          variant="subtle"
          onClick={() => setOpen(true)}
          className="gap-xs text-primary"
        >
          <PlusCircle size={16} />
          Add minor / specialization
        </Button>
      </div>
      {selected.length > 0 && (
        <div className="mt-sm flex flex-wrap gap-sm">
          {plans
            .filter((item) => selected.includes(item.id))
            .map((item) => {
              const progress = enhancementProgress(item, plan);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-sm rounded-lg border border-solid border-primary/20 bg-lecture/20 px-sm py-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPreview(item.id);
                      setSearch('');
                      setKind('all');
                      setOpen(true);
                    }}
                    className="bg-transparent p-0 text-left text-xs text-primary"
                  >
                    <span className="font-semibold">{item.title}</span>
                    <span className="ml-sm text-dark2">
                      {progress.planned}/{progress.total} planned
                    </span>
                  </button>
                  <ActionButton
                    label={`Remove ${item.title}`}
                    onClick={() => onToggle(item.id)}
                    className="flex h-7 w-7 items-center justify-center rounded bg-transparent text-dark2 hover:bg-light2"
                  >
                    <X size={14} />
                  </ActionButton>
                </div>
              );
            })}
        </div>
      )}
      <Modal
        isOpen={open}
        onRequestClose={() => setOpen(false)}
        contentLabel="Add a minor or specialization"
        className="degree-planner-dialog absolute left-1/2 top-1/2 max-h-[85vh] w-[calc(100%_-_32px)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl bg-white p-lg font-inter text-dark1 shadow-dropdown outline-none"
        overlayClassName="fixed inset-0 z-modal bg-primaryExtraDark/60"
      >
        <div className="mb-md flex items-center justify-between gap-md">
          <h2 className="m-0 text-xl font-semibold">Add to your degree</h2>
          <Button
            variant="subtle"
            size="icon"
            aria-label="Close enhancement picker"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </Button>
        </div>
        <div className="mb-md flex flex-wrap gap-sm">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="absolute left-3 top-3 text-dark3" />
            <input
              aria-label="Search minors and specializations"
              placeholder="Find a minor or specialization…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="box-border w-full rounded-lg border border-solid border-light3 bg-white py-sm pl-10 pr-sm text-sm outline-none focus:border-primary"
            />
          </div>
          <select
            aria-label="Enhancement type"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="rounded-lg border border-solid border-light3 bg-white px-sm py-sm text-sm"
          >
            <option value="all">All types</option>
            <option value="minor">Minors</option>
            <option value="specialization">Specializations</option>
          </select>
        </div>
        {!current ? (
          <p className="py-xl text-center text-sm text-dark2">
            No matching minors or specializations.
          </p>
        ) : (
          <div className="grid grid-cols-[minmax(180px,0.8fr)_minmax(0,1.5fr)] gap-lg tabletDown:grid-cols-1">
            <nav
              aria-label="Available enhancements"
              className="flex flex-col gap-sm"
            >
              {matches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={current.id === item.id}
                  onClick={() => setPreview(item.id)}
                  className={`rounded-lg border border-solid p-sm text-left ${
                    current.id === item.id
                      ? 'border-primary bg-lecture/20'
                      : 'border-light3 bg-white hover:bg-light1'
                  }`}
                >
                  <span className="block text-sm font-semibold">
                    {item.title}
                  </span>
                  <span className="mt-xs block text-xs text-dark2">
                    {item.units.toFixed(1)} units
                    {selected.includes(item.id) ? ' · Added' : ''}
                  </span>
                </button>
              ))}
            </nav>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-sm">
                <h3 className="m-0 text-lg font-semibold">{current.title}</h3>
                <a
                  href={current.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Calendar requirements for ${current.title}`}
                  className="shrink-0 text-primary"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
              <p className="mb-md mt-sm text-xs text-dark2">
                {current.calendar} · {coverage?.planned}/{coverage?.total}{' '}
                courses planned
              </p>
              <div className="grid gap-sm">
                {current.rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded-lg border border-solid border-light3 p-sm"
                  >
                    <div className="flex justify-between gap-sm text-sm">
                      <strong>{rule.label}</strong>
                      <span className="shrink-0 text-primary">
                        {coverage?.allocation[rule.id].length ?? 0}/{rule.count}
                      </span>
                    </div>
                    <p className="mb-0 mt-xs text-xs leading-relaxed text-dark2">
                      {rule.count === rule.courses.length
                        ? 'Complete all'
                        : 'Choose ' + rule.count + ':'}{' '}
                      {rule.courses.join(' · ')}
                    </p>
                    {rule.minimums.map((minimum) => (
                      <p
                        key={minimum.label}
                        className="mb-0 mt-xs text-xs text-dark2"
                      >
                        At least {minimum.count}: {minimum.label}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
              {current.notes.length > 0 && (
                <details className="mt-md text-xs leading-relaxed text-dark2">
                  <summary className="cursor-pointer font-semibold">
                    Calendar notes
                  </summary>
                  <ul className="pl-md">
                    {current.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </details>
              )}
              <p className="mt-md text-xs leading-relaxed text-dark3">
                Planning coverage only. Grades and declaration approval aren’t
                checked. Removing an enhancement keeps scheduled courses.
              </p>
              <Button
                variant="filter"
                disabled={selected.includes(current.id)}
                onClick={() => {
                  onToggle(current.id);
                  setOpen(false);
                }}
                className="mt-sm w-full"
              >
                {selected.includes(current.id)
                  ? 'Already added'
                  : `Add ${current.kind}`}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
};
export default DegreeEnhancementPicker;
