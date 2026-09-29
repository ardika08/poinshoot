<?php

namespace App\Http\Requests;

use App\Support\BoardConfig;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

class StoreGameRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $maxAttempts = BoardConfig::maxAttempts();

        return [
            'player_id' => ['required', 'integer', 'exists:players,id'],
            'attempt_number' => ['required', 'integer', 'min:1', 'max:' . $maxAttempts],
            'is_successful' => ['required', 'boolean'],
            'points' => ['required', 'integer', 'min:0'],
            'zone_name' => ['nullable', 'string', 'max:50', Rule::in(BoardConfig::ids())],
            'game_mode' => ['required', 'in:manual,simulation'],
            'round_id' => ['nullable', 'integer', 'exists:rounds,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'player_id.required' => 'Pemain wajib dipilih',
            'player_id.exists' => 'Pemain tidak ditemukan',
            'attempt_number.required' => 'Nomor percobaan wajib diisi',
            'attempt_number.max' => 'Maksimal ' . BoardConfig::maxAttempts() . ' percobaan per ronde',
            'points.required' => 'Poin wajib diisi',
            'points.min' => 'Poin tidak boleh negatif',
            'zone_name.in' => 'Lubang tidak dikenal',
            'game_mode.in' => 'Mode permainan harus manual atau simulation',
        ];
    }

    protected function prepareForValidation(): void
    {
        // Bola tidak masuk papan sama sekali -> tanpa lubang, poin 0.
        if ($this->has('is_successful') && ! $this->boolean('is_successful')) {
            $this->merge(['points' => 0, 'zone_name' => null]);
        }
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            // Hanya relevan saat bola masuk salah satu lubang.
            if (! $this->boolean('is_successful')) {
                return;
            }

            $hole = BoardConfig::find($this->input('zone_name'));

            if (! $hole) {
                $validator->errors()->add('zone_name', 'Lubang wajib dipilih saat bola masuk');

                return;
            }

            // Poin wajib sama persis dengan nilai lubang di config.
            if ((int) $this->input('points') !== $hole['points']) {
                $validator->errors()->add(
                    'points',
                    "Poin lubang {$hole['id']} seharusnya {$hole['points']}, bukan {$this->input('points')}"
                );
            }
        });
    }

    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'error' => [
                'code' => 'VALIDATION_ERROR',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors()->toArray(),
            ],
        ], 422));
    }
}
