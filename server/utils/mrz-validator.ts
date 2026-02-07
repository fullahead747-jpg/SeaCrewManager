/**
 * Utility for validating Machine Readable Zone (MRZ) data from identity documents.
 * Supports TD3 (Passport) format.
 */
export class MRZValidator {
    /**
     * MRZ Checksum weight: 7, 3, 1 repeating
     */
    private static readonly WEIGHTS = [7, 3, 1];

    /**
     * Calculate MRZ checksum for a given string
     */
    static calculateChecksum(str: string): number {
        let sum = 0;
        const charMap = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            let val = 0;

            if (char === '<') {
                val = 0;
            } else {
                val = charMap.indexOf(char.toUpperCase());
                if (val === -1) val = 0;
            }

            const weight = this.WEIGHTS[i % 3];
            sum += val * weight;
        }

        return sum % 10;
    }

    /**
     * Parse and validate TD3 (Passport) MRZ
     * Usually 2 lines of 44 characters
     */
    static validateTD3(line1: string, line2: string): {
        isValid: boolean;
        errors: string[];
        fieldValidation: {
            documentNumber: boolean;
            dateOfBirth: boolean;
            expiryDate: boolean;
            composite: boolean;
        };
        data: {
            documentNumber?: string;
            nationality?: string;
            dateOfBirth?: string;
            sex?: string;
            expiryDate?: string;
            personalNumber?: string;
            holderName?: string;
        }
    } {
        const errors: string[] = [];
        const data: any = {};
        const fieldValidation = {
            documentNumber: true,
            dateOfBirth: true,
            expiryDate: true,
            composite: true
        };

        if (line1.length !== 44 || line2.length !== 44) {
            errors.push('Invalid line length (expected 44 characters for TD3/Passport)');
            return {
                isValid: false,
                errors,
                fieldValidation: {
                    documentNumber: false,
                    dateOfBirth: false,
                    expiryDate: false,
                    composite: false
                },
                data
            };
        }

        // Line 1 Parsing: Holder Name
        // Passport MRZ Line 1: P<COUNTRYNAME<<SURNAME<<<<<<<<<<<<<<<<<<<<<<<<<<
        // Name usually starts at index 5 for TD3
        const namePart = line1.substring(5);
        data.holderName = namePart.replace(/<+/g, ' ').trim();

        // Line 2 Checksums
        // Document Number: 0-9, Checksum: 9
        const docNum = line2.substring(0, 9);
        const docNumCheck = parseInt(line2[9], 10);
        if (this.calculateChecksum(docNum) !== docNumCheck) {
            errors.push('Document number checksum fail');
            fieldValidation.documentNumber = false;
        }
        data.documentNumber = docNum.replace(/</g, '');

        // Date of Birth: 13-19, Checksum: 19
        const dob = line2.substring(13, 19);
        const dobCheck = parseInt(line2[19], 10);
        if (this.calculateChecksum(dob) !== dobCheck) {
            errors.push('Date of birth checksum fail');
            fieldValidation.dateOfBirth = false;
        }
        data.dateOfBirth = dob; // YYMMDD format

        // Expiry Date: 21-27, Checksum: 27
        const expiry = line2.substring(21, 27);
        const expiryCheck = parseInt(line2[27], 10);
        if (this.calculateChecksum(expiry) !== expiryCheck) {
            errors.push('Expiry date checksum fail');
            fieldValidation.expiryDate = false;
        }
        data.expiryDate = expiry; // YYMMDD format

        // Combined Checksum: 0-10, 13-20, 21-43
        // Indexing: line2[0..9], line2[9], line2[13..18], line2[19], line2[21..27], line2[27], line2[28..42], line2[43]
        const composite = line2.substring(0, 10) + line2.substring(13, 20) + line2.substring(21, 43);
        const compositeCheck = parseInt(line2[43], 10);
        if (this.calculateChecksum(composite) !== compositeCheck) {
            errors.push('Composite checksum fail');
            fieldValidation.composite = false;
        }

        data.nationality = line2.substring(10, 13);
        data.sex = line2[20];
        data.personalNumber = line2.substring(28, 42).replace(/</g, '');

        return {
            isValid: errors.length === 0,
            errors,
            fieldValidation,
            data
        };
    }

    /**
     * Map MRZ dates (YYMMDD) to robust dates
     */
    static mrzDateToDate(mrzDate: string, isExpiry: boolean = false): Date | null {
        if (!/^\d{6}$/.test(mrzDate)) return null;

        const yy = parseInt(mrzDate.substring(0, 2), 10);
        const mm = parseInt(mrzDate.substring(2, 4), 10);
        const dd = parseInt(mrzDate.substring(4, 6), 10);

        // Determine century (simple logic for now)
        // If expiry, 20xx is likely. If DOB, depends on yy.
        let year = 2000 + yy;
        if (!isExpiry && yy > 25) { // If DOB yy > 25, assume 19xx
            year = 1900 + yy;
        }

        const date = new Date(year, mm - 1, dd);
        if (isNaN(date.getTime())) return null;
        return date;
    }
}
